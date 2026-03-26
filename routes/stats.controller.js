import Bill from "../models/bill.schema.js";
import Expense from "../models/expense.schema.js";
import Product from "../models/product.schema.js";
import { setCache } from "../config/redis.js";

console.log("[Stats Controller] Loaded");

export const getOverallStats = async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const cacheKey = req.cacheKey;

        const [productCount, billCount, revenueStats, expenseStats] = await Promise.all([
            Product.countDocuments({ businessId }),
            Bill.countDocuments({ businessId }),
            Bill.aggregate([
                { $match: { businessId } },
                { $group: { _id: null, totalRevenue: { $sum: "$grandTotal" } } }
            ]),
            Expense.aggregate([
                { $match: { businessId } },
                { $group: { _id: null, totalExpenses: { $sum: "$totalCost" } } }
            ])
        ]);

        const totalRevenue = revenueStats[0]?.totalRevenue || 0;
        const totalExpenses = expenseStats[0]?.totalExpenses || 0;

        const result = {
            totalProducts: productCount,
            totalBills: billCount,
            totalRevenue,
            totalExpenses,
            totalProfit: totalRevenue - totalExpenses
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
        const { period = 'monthly' } = req.query;
        const businessId = req.user.businessId;
        const cacheKey = req.cacheKey;

        // Fetch raw data to group in JS for maximum reliability
        const [bills, expenses] = await Promise.all([
            Bill.find({ businessId: req.user.businessId }).select('grandTotal date createdAt').lean(),
            Expense.find({ businessId: req.user.businessId }).select('totalCost date createdAt').lean()
        ]);
        // ... (existing processing logic)
        // Note: I'm keeping the logic here but adding setCache after result is calculated
        
        // (Wait, I should replace the whole function content to be safe)

        const mergeMap = {};

        const getMonthKey = (date, fallback) => {
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

        bills.forEach(bill => {
            const key = getMonthKey(bill.date, bill.createdAt);
            if (!mergeMap[key]) mergeMap[key] = { label: key, revenue: 0, expenses: 0, profit: 0 };
            const amount = Number(bill.grandTotal) || 0;
            mergeMap[key].revenue += amount;
            mergeMap[key].profit += amount;
        });

        expenses.forEach(exp => {
            const key = getMonthKey(exp.date, exp.createdAt);
            if (!mergeMap[key]) mergeMap[key] = { label: key, revenue: 0, expenses: 0, profit: 0 };
            const cost = Number(exp.totalCost) || 0;
            mergeMap[key].expenses += cost;
            mergeMap[key].profit -= cost;
        });

        // Ensure we have at least SOME data if bills/expenses exist but grouping fails
        if (Object.keys(mergeMap).length === 0 && (bills.length > 0 || expenses.length > 0)) {
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
        res.status(500).json({ 
            error: "Failed to fetch analytics", 
            message: error.message,
            stack: error.stack 
        });
    }
};

export const getProductAnalytics = async (req, res) => {
    try {
        const { productName } = req.query;
        const businessId = req.user.businessId;

        if (!productName) return res.status(400).json({ error: "productName is required" });

        const cacheKey = req.cacheKey;

        const [bills, expenses] = await Promise.all([
            Bill.find({ businessId: req.user.businessId, "items.name": { $regex: new RegExp(`^${productName}$`, "i") } }).select('items createdAt date').lean(),
            Expense.find({ businessId: req.user.businessId, productName: { $regex: new RegExp(`^${productName}$`, "i") } }).select('totalCost date createdAt').lean()
        ]);

        const mergeMap = {};
        let totalRevenue = 0;
        let totalExpense = 0;

        const getMonthKey = (date, fallback) => {
            try {
                const d = new Date(date || fallback);
                if (isNaN(d.getTime())) return "Unknown";
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } catch {
                return "Unknown";
            }
        };

        bills.forEach(bill => {
            const billKey = getMonthKey(bill.date, bill.createdAt);
            if (!mergeMap[billKey]) mergeMap[billKey] = { label: billKey, revenue: 0, expenses: 0, profit: 0 };
            
            bill.items.forEach(item => {
                if (item.name.toLowerCase() === productName.toLowerCase()) {
                    mergeMap[billKey].revenue += (item.amount || 0);
                    mergeMap[billKey].profit += (item.amount || 0);
                    totalRevenue += (item.amount || 0);
                }
            });
        });

        expenses.forEach(exp => {
            const expKey = getMonthKey(exp.date, exp.createdAt);
            if (!mergeMap[expKey]) mergeMap[expKey] = { label: expKey, revenue: 0, expenses: 0, profit: 0 };
            mergeMap[expKey].expenses += (exp.totalCost || 0);
            mergeMap[expKey].profit -= (exp.totalCost || 0);
            totalExpense += (exp.totalCost || 0);
        });

        const result = {
            totalRevenue,
            totalExpense,
            totalProfit: totalRevenue - totalExpense,
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
