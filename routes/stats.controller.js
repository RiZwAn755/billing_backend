import Bill from "../models/bill.schema.js";
import Expense from "../models/expense.schema.js";
import Product from "../models/product.schema.js";
import { setCache } from "../config/redis.js";

console.log("[Stats Controller] Loaded");

export const getOverallStats = async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const cacheKey = req.cacheKey;

        const [productCount, billCount, products, bills, expenses] = await Promise.all([
            Product.countDocuments({ businessId }),
            Bill.countDocuments({ businessId }),
            Product.find({ businessId }).select('name buyingPrice createdAt').lean(),
            Bill.find({ businessId }).select('grandTotal items date createdAt').lean(),
            Expense.find({ businessId }).select('productName units costPerUnit totalCost date createdAt').lean()
        ]);

        const dateFilter = req.query.date;
        const startDateFilter = req.query.startDate;
        const endDateFilter = req.query.endDate;

        const getLocalYYYYMMDD = () => {
            const now = new Date();
            const offsetMs = now.getTimezoneOffset() * 60 * 1000;
            const localDate = new Date(now.getTime() - offsetMs);
            return localDate.toISOString().split('T')[0];
        };
        const targetStr = dateFilter || getLocalYYYYMMDD();
        
        const checkIsTargetDate = (dateVal) => {
            if (!dateVal) return false;
            try {
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return false;
                const localD = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
                const computed = localD.toISOString().split('T')[0];

                if (startDateFilter && endDateFilter) {
                    return computed >= startDateFilter && computed <= endDateFilter;
                }

                return computed === targetStr;
            } catch { return false; }
        };

        // Build CP map from products catalog (fallback)
        const cpMap = {};
        let todayProducts = 0;
        products.forEach(p => {
            cpMap[(p.name || '').toLowerCase()] = Number(p.buyingPrice) || 0;
            if (checkIsTargetDate(p.createdAt)) todayProducts++;
        });

        // Total Revenue = sum of grandTotal from all bills (Qs × SP)
        // Also build soldQty map: productName -> total qty sold
        const soldQtyMap = {};
        let totalRevenue = 0;
        let todayBills = 0;
        let todayRevenue = 0;
        let todayCOGS = 0; // COGS only for today's sold items

        bills.forEach(bill => {
            const billTotal = Number(bill.grandTotal) || 0;
            totalRevenue += billTotal;
            
            const isToday = checkIsTargetDate(bill.date || bill.createdAt);
            if (isToday) {
                todayBills++;
                todayRevenue += billTotal;
            }

            // Track qty sold per product (all time)
            (bill.items || []).forEach(item => {
                const key = (item.name || '').toLowerCase();
                soldQtyMap[key] = (soldQtyMap[key] || 0) + (Number(item.qty) || 0);

                // Track COGS for today's sales specifically
                if (isToday) {
                    const cp = cpMap[key] || 0;
                    todayCOGS += (Number(item.qty) || 0) * cp;
                }
            });
        });

        // Total Cost = sum of expense.totalCost (Qp × CP — what was purchased)
        // Also build purchasedQty map: productName -> { Qp, CP }
        const purchaseMap = {};
        let totalExpenses = 0;
        let todayExpenses = 0;

        expenses.forEach(exp => {
            const cost = Number(exp.totalCost) || 0;
            totalExpenses += cost;
            if (checkIsTargetDate(exp.date || exp.createdAt)) {
                todayExpenses += cost;
            }

            // Track quantity purchased per product
            const key = (exp.productName || '').toLowerCase();
            if (key) {
                if (!purchaseMap[key]) purchaseMap[key] = { Qp: 0, CP: 0 };
                purchaseMap[key].Qp += Number(exp.units) || 0;
                // Use costPerUnit from expense, fallback to buyingPrice from product
                if (Number(exp.costPerUnit) > 0) {
                    purchaseMap[key].CP = Number(exp.costPerUnit);
                } else if (!purchaseMap[key].CP) {
                    purchaseMap[key].CP = cpMap[key] || 0;
                }
            }
        });

        // Remaining Stock Value = Σ per product: max(0, Qp - Qs) × CP
        // This is (Qp - Qs) × CP from Case 2 formula
        let remainingStockValue = 0;
        Object.keys(purchaseMap).forEach(key => {
            const { Qp, CP } = purchaseMap[key];
            const Qs = soldQtyMap[key] || 0;
            const remainingQty = Math.max(0, Qp - Qs);
            remainingStockValue += remainingQty * CP;
        });

        let totalProfit;

        if (dateFilter || (startDateFilter && endDateFilter)) {
            // Date-filtered view: show that specific period's numbers on the cards
            totalRevenue = todayRevenue;
            totalExpenses = todayExpenses;
            // Period's profit = Period's Revenue - Period's COGS
            totalProfit = todayRevenue - todayCOGS;
        } else {
            // All-time view: Net Profit = Revenue + Remaining Stock Value - Total Cost
            // (Case 2 formula: Revenue + (Qp-Qs)×CP - Qp×CP = Revenue - Qs×CP)
            totalProfit = totalRevenue + remainingStockValue - totalExpenses;
        }

        // Today's Profit for dashboard home card (always uses COGS, not expenses)
        const todayProfit = todayRevenue - todayCOGS;

        const result = {
            totalProducts: productCount,
            totalBills: billCount,
            totalRevenue,
            totalExpenses,
            totalProfit,
            remainingStockValue,
            todayProducts,
            todayBills,
            todayRevenue,
            todayProfit
        };

        // Cache for 24 hours
        await setCache(cacheKey, result, 86400);

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching overall stats:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
};

export const getProfitAnalytics = async (req, res) => {
    try {
        const { period = 'monthly', date: dateFilter } = req.query;
        const businessId = req.user.businessId;
        const cacheKey = req.cacheKey;

        // Fetch raw data to group in JS
        const [bills, expenses] = await Promise.all([
            Bill.find({ businessId }).select('grandTotal date createdAt').lean(),
            Expense.find({ businessId }).select('totalCost date createdAt').lean()
        ]);

        const mergeMap = {};

        const checkIsTargetDate = (dateVal) => {
            if (!dateFilter || !dateVal) return false;
            try {
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return false;
                const localD = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
                return localD.toISOString().split('T')[0] === dateFilter;
            } catch { return false; }
        };

        const getGroupKey = (date, fallback) => {
            if (dateFilter) return dateFilter; // Hard group into single day bar
            try {
                const d = new Date(date || fallback);
                if (isNaN(d.getTime())) return "Unknown";
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                if (period === 'yearly') return `${y}`;
                return `${y}-${m}`;
            } catch {
                return "Unknown";
            }
        };

        // Revenue = sum of grandTotal per period (Qs × SP)
        bills.forEach(bill => {
            if (dateFilter && !checkIsTargetDate(bill.date || bill.createdAt)) return;

            const key = getGroupKey(bill.date, bill.createdAt);
            if (!mergeMap[key]) mergeMap[key] = { label: key, revenue: 0, expenses: 0, profit: 0 };
            mergeMap[key].revenue += Number(bill.grandTotal) || 0;
        });

        // Expenses = Total Cost per period (Qp × CP from expense records)
        expenses.forEach(exp => {
            if (dateFilter && !checkIsTargetDate(exp.date || exp.createdAt)) return;

            const key = getGroupKey(exp.date, exp.createdAt);
            if (!mergeMap[key]) mergeMap[key] = { label: key, revenue: 0, expenses: 0, profit: 0 };
            mergeMap[key].expenses += Number(exp.totalCost) || 0;
        });

        // Profit per period = Revenue - Expenses (simplified: no per-period remaining stock)
        // Net Profit = Revenue - Total Cost (expenses represent cost of goods purchased)
        Object.values(mergeMap).forEach(entry => {
            entry.profit = entry.revenue - entry.expenses;
        });

        // Ensure we have at least SOME data if bills/expenses exist but grouping fails
        if (Object.keys(mergeMap).length === 0 && !dateFilter && (bills.length > 0 || expenses.length > 0)) {
            const fallbackKey = period === 'yearly' ? new Date().getFullYear().toString() : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            mergeMap[fallbackKey] = { label: fallbackKey, revenue: 0, expenses: 0, profit: 0 };
        }

        let result = Object.values(mergeMap).sort((a, b) => String(a.label).localeCompare(String(b.label)));

        if (period === 'half-yearly') {
            const hMap = {};
            result.forEach(item => {
                if (item.label === "Unknown") return;
                const [y, m] = item.label.split('-');
                const h = parseInt(m) <= 6 ? 'H1' : 'H2';
                const key = `${y} ${h}`;
                if (!hMap[key]) hMap[key] = { label: key, revenue: 0, expenses: 0, profit: 0 };
                hMap[key].revenue += item.revenue;
                hMap[key].expenses += item.expenses;
                hMap[key].profit += item.profit;
            });
            result = Object.values(hMap).sort((a, b) => a.label.localeCompare(b.label));
        }

        // Cache result
        await setCache(cacheKey, result, 86400);

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching profit analytics:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
};

export const getProductAnalytics = async (req, res) => {
    try {
        const { productName } = req.query;
        const businessId = req.user.businessId;

        if (!productName) return res.status(400).json({ error: "productName is required" });

        const cacheKey = req.cacheKey;

        const [bills, expenses, productData] = await Promise.all([
            Bill.find({ businessId: req.user.businessId, "items.name": { $regex: new RegExp(`^${productName}$`, "i") } }).select('items createdAt date subtotal discountAmount grandTotal').lean(),
            Expense.find({ businessId: req.user.businessId, productName: { $regex: new RegExp(`^${productName}$`, "i") } }).select('units costPerUnit totalCost date createdAt').lean(),
            Product.findOne({ businessId: req.user.businessId, name: { $regex: new RegExp(`^${productName}$`, "i") } }).select('buyingPrice').lean()
        ]);

        const mergeMap = {};
        let totalRevenue = 0;
        let totalExpense = 0;
        let totalQsSold = 0;
        let totalQpPurchased = 0;

        const getMonthKey = (date, fallback) => {
            try {
                const d = new Date(date || fallback);
                if (isNaN(d.getTime())) return "Unknown";
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } catch {
                return "Unknown";
            }
        };

        // CP = costPerUnit from latest expense, fallback to product buyingPrice
        let cp = Number(productData?.buyingPrice) || 0;
        if (expenses.length > 0) {
            const latestExp = expenses.find(e => Number(e.costPerUnit) > 0);
            if (latestExp) cp = Number(latestExp.costPerUnit);
        }

        // Track total Qp (quantity purchased) from expenses
        expenses.forEach(exp => {
            const expKey = getMonthKey(exp.date, exp.createdAt);
            if (!mergeMap[expKey]) mergeMap[expKey] = { label: expKey, revenue: 0, expenses: 0, profit: 0 };
            const cost = Number(exp.totalCost) || 0;
            mergeMap[expKey].expenses += cost;
            totalExpense += cost;
            totalQpPurchased += Number(exp.units) || 0;
        });

        // Track total Qs (quantity sold) from bills
        bills.forEach(bill => {
            const billKey = getMonthKey(bill.date, bill.createdAt);
            if (!mergeMap[billKey]) mergeMap[billKey] = { label: billKey, revenue: 0, expenses: 0, profit: 0 };
            
            const discountRatio = (bill.discountAmount && bill.subtotal) ? (bill.discountAmount / bill.subtotal) : 0;
            
            (bill.items || []).forEach(item => {
                if ((item.name || '').toLowerCase() === productName.toLowerCase()) {
                    const itemRevenue = Number(item.amount) || 0;
                    const finalItemRevenue = itemRevenue - (itemRevenue * discountRatio);
                    const qtySold = Number(item.qty) || 0;

                    mergeMap[billKey].revenue += finalItemRevenue;
                    totalRevenue += finalItemRevenue;
                    totalQsSold += qtySold;
                }
            });
        });

        // Remaining Stock Value = max(0, Qp - Qs) × CP
        const remainingQty = Math.max(0, totalQpPurchased - totalQsSold);
        const remainingStockValue = remainingQty * cp;

        // Net Profit = Revenue + Remaining Stock Value - Total Cost (Case 2 formula)
        const totalProfit = totalRevenue + remainingStockValue - totalExpense;

        // Per-month profit = revenue - expenses for the chart
        Object.values(mergeMap).forEach(entry => {
            entry.profit = entry.revenue - entry.expenses;
        });

        const result = {
            totalRevenue,
            totalExpense,
            totalProfit,
            remainingStockValue,
            monthly: Object.values(mergeMap).sort((a, b) => String(a.label).localeCompare(String(b.label)))
        };

        // Cache for 24 hours
        await setCache(cacheKey, result, 86400);

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching product analytics:", error);
        res.status(500).json({ error: "Failed to fetch product analytics" });
    }
};
