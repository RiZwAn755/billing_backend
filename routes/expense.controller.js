import Expense from "../models/expense.schema.js";

export const createExpense = async (req, res) => {
    try {
        const expenseData = req.body;
        // Inject businessId directly from the validated JWT token payload
        expenseData.businessId = req.user.businessId;

        const expense = new Expense(expenseData);
        await expense.save();
        res.status(201).json({
            ...expense.toObject(),
            id: expense._id.toString()
        });
    } catch (error) {
        console.error("Error creating expense:", error);
        res.status(500).json({ error: "Failed to create expense" });
    }
};

export const getExpenses = async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;
        const total = await Expense.countDocuments({ businessId: req.user.businessId });
        const expenses = await Expense.find({ businessId: req.user.businessId })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
        
        const formattedExpenses = expenses.map(e => ({
            ...e.toObject(),
            id: e._id.toString()
        }));
        res.status(200).json({ expenses: formattedExpenses, total });
    } catch (error) {
        console.error("Error fetching expenses:", error);
        res.status(500).json({ error: "Failed to fetch expenses" });
    }
};

export const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Ensure we only update if it belongs to this business
        const expense = await Expense.findOneAndUpdate(
            { _id: id, businessId: req.user.businessId },
            updates,
            { new: true }
        );

        if (!expense) {
            return res.status(404).json({ error: "Expense not found or unauthorized" });
        }

        res.status(200).json({
             ...expense.toObject(),
             id: expense._id.toString()
        });
    } catch (error) {
        console.error("Error updating expense:", error);
        res.status(500).json({ error: "Failed to update expense" });
    }
};

export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        const expense = await Expense.findOneAndDelete({
            _id: id,
            businessId: req.user.businessId
        });

        if (!expense) {
            return res.status(404).json({ error: "Expense not found or unauthorized" });
        }

        res.status(200).json({ message: "Expense deleted successfully" });
    } catch (error) {
        console.error("Error deleting expense:", error);
        res.status(500).json({ error: "Failed to delete expense" });
    }
};
