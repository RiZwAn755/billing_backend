import mongoose from "mongoose";

const billSchema = new mongoose.Schema({
    customerName: {
        type: String,
        default: 'Walk-in Customer'
    },
    items: [
        {
            id: { type: String }, // Optional ref to product ID
            name: { type: String, required: true },
            price: { type: Number, required: true },
            qty: { type: Number, required: true },
            unit: { type: String },
            amount: { type: Number, required: true }
        }
    ],
    subtotal: {
        type: Number,
        required: true
    },
    discountType: {
        type: String,
        enum: ['percent', 'flat'],
        default: 'percent'
    },
    discountValue: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number,
        required: true
    },
    businessId: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    billNumber: {
        type: Number
    }
}, { timestamps: true });

billSchema.pre("save", async function () {
    if (this.isNew) {
        const last = await this.constructor.findOne(
            { businessId: this.businessId, billNumber: { $exists: true } },
            { billNumber: 1 },
            { sort: { billNumber: -1 } }
        );
        this.billNumber = last ? last.billNumber + 1 : 1;
    }
});

// Index for performance filtering by businessId
billSchema.index({ businessId: 1 });

const Bill = mongoose.model("Bill", billSchema);

export default Bill;
