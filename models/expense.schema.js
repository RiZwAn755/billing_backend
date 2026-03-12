import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true,
        trim: true
    },
    units: {
        type: Number,
        default: 0
    },
    costPerUnit: {
        type: Number,
        default: 0
    },
    totalCost: {
        type: Number,
        required: true
    },
    supplier: {
        type: String,
        trim: true
    },
    date: {
        type: String,
        required: true
    },
    notes: {
        type: String,
        trim: true
    },
    businessId: {
        type: String,
        required: true,
        index: true // Key for strict isolation
    }
}, { timestamps: true });

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
