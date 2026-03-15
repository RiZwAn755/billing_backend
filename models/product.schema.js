import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    buyingPrice: {
        type: Number,
        default: 0
    },
    unit: {
        type: String,
        default: 'pcs'
    },
    category: {
        type: String,
        default: ''
    },
    quantity: {
        type: Number,
        default: 0
    },
    expiryDate: {
        type: Date
    },
    businessId: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Index for performance filtering by businessId
productSchema.index({ businessId: 1 });

// Index for performance
productSchema.index({ businessId: 1, createdAt: -1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
