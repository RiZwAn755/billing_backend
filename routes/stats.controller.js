import Bill from "../models/bill.schema.js";
import Expense from "../models/expense.schema.js";
import Product from "../models/product.schema.js";

export const getOverallStats = async (req, res) => {
    try {
        const businessId = req.user.businessId;

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

        res.status(200).json({
            totalProducts: productCount,
            totalBills: billCount,
            totalRevenue,
            totalExpenses,
            totalProfit: totalRevenue - totalExpenses
        });
    } catch (error) {
        console.error("Error fetching overall stats:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
};

export const getProfitAnalytics = async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        const businessId = req.user.businessId;

        let dateFormat = "%Y-%m";
        if (period === 'yearly') dateFormat = "%Y";
        // half-yearly handling requires more complex logic in $group or post-processing

        const revenueData = await Bill.aggregate([
            { $match: { businessId } },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
                    revenue: { $sum: "$grandTotal" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const expenseData = await Expense.aggregate([
            { $match: { businessId } },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: "$date" } },
                    expenses: { $sum: "$totalCost" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Merge logic
        const mergeMap = {};
        revenueData.forEach(item => {
            mergeMap[item._id] = { label: item._id, revenue: item.revenue, expenses: 0, profit: item.revenue };
        });
        expenseData.forEach(item => {
            if (!mergeMap[item._id]) {
                mergeMap[item._id] = { label: item._id, revenue: 0, expenses: item.expenses, profit: -item.expenses };
            } else {
                mergeMap[item._id].expenses = item.expenses;
                mergeMap[item._id].profit = mergeMap[item._id].revenue - item.expenses;
            }
        });

        // Special handling for half-yearly if needed, otherwise this works for monthly/yearly
        let result = Object.values(mergeMap).sort((a, b) => a.label.localeCompare(b.label));
        
        if (period === 'half-yearly') {
             // Post-process monthly into half-yearly if that's what's requested
             const hMap = {};
             result.forEach(item => {
                 const [y, m] = item.label.split('-');
                 const h = parseInt(m) <= 6 ? 'H1' : 'H2';
                 const key = `${y} ${h}`;
                 if (!hMap[key]) {
                     hMap[key] = { label: key, revenue: 0, expenses: 0, profit: 0 };
                 }
                 hMap[key].revenue += item.revenue;
                 hMap[key].expenses += item.expenses;
                 hMap[key].profit += item.profit;
             });
             result = Object.values(hMap).sort((a, b) => a.label.localeCompare(b.label));
        }

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

        const [revenueData, expenseData] = await Promise.all([
            Bill.aggregate([
                { $match: { businessId, "items.name": { $regex: new RegExp(`^${productName}$`, "i") } } },
                { $unwind: "$items" },
                { $match: { "items.name": { $regex: new RegExp(`^${productName}$`, "i") } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        revenue: { $sum: "$items.amount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Expense.aggregate([
                { $match: { businessId, productName: { $regex: new RegExp(`^${productName}$`, "i") } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                        expenses: { $sum: "$totalCost" }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
        const totalExpense = expenseData.reduce((sum, item) => sum + item.expenses, 0);

        const mergeMap = {};
        revenueData.forEach(item => {
            mergeMap[item._id] = { label: item._id, revenue: item.revenue, expenses: 0, profit: item.revenue };
        });
        expenseData.forEach(item => {
            if (!mergeMap[item._id]) {
                mergeMap[item._id] = { label: item._id, revenue: 0, expenses: item.expenses, profit: -item.expenses };
            } else {
                mergeMap[item._id].expenses = item.expenses;
                mergeMap[item._id].profit = mergeMap[item._id].revenue - item.expenses;
            }
        });

        res.status(200).json({
            totalRevenue,
            totalExpense,
            totalProfit: totalRevenue - totalExpense,
            monthly: Object.values(mergeMap).sort((a, b) => a.label.localeCompare(b.label))
        });
    } catch (error) {
        console.error("Error fetching product analytics:", error);
        res.status(500).json({ error: "Failed to fetch product analytics" });
    }
};
