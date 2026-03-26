import Bill from "../models/bill.schema.js";
import Product from "../models/product.schema.js";
import { setCache, invalidateBusinessCache } from "../config/redis.js";

// Helper strictly for business isolation generating unique bill numbers per business
export const getNextBillNumber = async (businessId) => {
    // Basic implementation: Count existing bills for this business and add 1
    const count = await Bill.countDocuments({ businessId });
    return count + 1;
};

export const createBill = async (req, res) => {
    let reducedStockItems = [];
    try {
        const billData = req.body;
        billData.businessId = req.user.businessId;
        // billNumber is auto-assigned by the pre-save hook in bill.schema.js

        const items = Array.isArray(billData.items) ? billData.items : [];
        const stockItems = items
            .filter(item => item?.id)
            .map(item => ({
                productId: item.id,
                qty: Number(item.qty) || 0,
                name: item.name || 'Unknown Product'
            }))
            .filter(item => item.qty > 0);

        if (stockItems.length > 0) {
            try {
                for (const item of stockItems) {
                    const updated = await Product.findOneAndUpdate(
                        {
                            _id: item.productId,
                            businessId: req.user.businessId,
                            quantity: { $gte: item.qty }
                        },
                        { $inc: { quantity: -item.qty } },
                        { new: true }
                    );

                    if (!updated) {
                        throw new Error(`Insufficient stock for ${item.name}`);
                    }

                    reducedStockItems.push(item);
                }
            } catch (stockError) {
                if (reducedStockItems.length > 0) {
                    await Promise.all(
                        reducedStockItems.map(item =>
                            Product.findOneAndUpdate(
                                { _id: item.productId, businessId: req.user.businessId },
                                { $inc: { quantity: item.qty } }
                            )
                        )
                    );
                    reducedStockItems = [];
                }

                return res.status(400).json({ error: stockError.message || 'Insufficient stock' });
            }
        }

        const bill = new Bill(billData);
        await bill.save();

        // Invalidate Cache
        await invalidateBusinessCache(req.user.businessId);

        res.status(201).json({
            ...bill.toObject(),
            id: bill._id.toString()
        });
    } catch (error) {
        if (reducedStockItems.length > 0) {
            await Promise.all(
                reducedStockItems.map(item =>
                    Product.findOneAndUpdate(
                        { _id: item.productId, businessId: req.user.businessId },
                        { $inc: { quantity: item.qty } }
                    )
                )
            );
        }

        console.error("Error creating bill:", error.message, error.code, error.keyValue);
        res.status(500).json({ error: "Failed to create bill", detail: error.message });
    }
};

export const getBills = async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;
        const businessId = req.user.businessId;
        const cacheKey = req.cacheKey;

        const total = await Bill.countDocuments({ businessId });
        const bills = await Bill.find({ businessId })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .select('billNumber customerName grandTotal date createdAt')
            .lean();
        
        const formattedBills = bills.map(b => ({
            ...b,
            id: b._id.toString()
        }));

        const result = { bills: formattedBills, total };

        // Cache for 10 minutes (shorter duration for listings)
        await setCache(cacheKey, result, 600);

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching bills:", error);
        res.status(500).json({ error: "Failed to fetch bills" });
    }
};

export const getBillById = async (req, res) => {
    try {
        const { id } = req.params;
        const bill = await Bill.findOne({ _id: id, businessId: req.user.businessId }).lean();

        if (!bill) {
            return res.status(404).json({ error: "Bill not found or unauthorized" });
        }
        res.status(200).json({
            ...bill,
            id: bill._id.toString()
        });
    } catch (error) {
        console.error("Error fetching bill:", error);
        res.status(500).json({ error: "Failed to fetch bill" });
    }
};

export const getPublicBillById = async (req, res) => {
    try {
        const { id } = req.params;
        const bill = await Bill.findById(id).lean();

        if (!bill) {
            return res.status(404).json({ error: "Bill not found" });
        }

        // Look up business name for the PDF header
        let businessName = 'Invoice';
        try {
            const User = (await import('../models/user.schema.js')).default;
            const user = await User.findOne({ businessId: bill.businessId }).lean();
            if (user) businessName = user.businessName;
        } catch (e) { /* ignore */ }

        res.status(200).json({
            ...bill,
            id: bill._id.toString(),
            businessName
        });
    } catch (error) {
        console.error("Error fetching public bill:", error);
        res.status(500).json({ error: "Failed to fetch bill" });
    }
};

export const updateBill = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const existingBill = await Bill.findOne({ _id: id, businessId: req.user.businessId });
        if (!existingBill) {
            return res.status(404).json({ error: "Bill not found or unauthorized" });
        }

        const historySnapshot = {
            modifiedAt: new Date(),
            customerName: existingBill.customerName,
            customerPhone: existingBill.customerPhone,
            items: existingBill.items,
            subtotal: existingBill.subtotal,
            discountType: existingBill.discountType,
            discountValue: existingBill.discountValue,
            discountAmount: existingBill.discountAmount,
            grandTotal: existingBill.grandTotal,
        };

        const bill = await Bill.findOneAndUpdate(
            { _id: id, businessId: req.user.businessId },
            { 
                $set: updates,
                $push: { editHistory: historySnapshot }
            },
            { new: true }
        );

        // Invalidate Cache
        await invalidateBusinessCache(req.user.businessId);

        res.status(200).json({
            ...bill.toObject(),
            id: bill._id.toString()
        });
    } catch (error) {
        console.error("Error updating bill:", error);
        res.status(500).json({ error: "Failed to update bill" });
    }
};

export const deleteBill = async (req, res) => {
    try {
        const { id } = req.params;

        const bill = await Bill.findOneAndDelete({
            _id: id,
            businessId: req.user.businessId
        });

        if (!bill) {
            return res.status(404).json({ error: "Bill not found or unauthorized" });
        }

        // Invalidate Cache
        await invalidateBusinessCache(req.user.businessId);

        res.status(200).json({ message: "Bill deleted successfully" });
    } catch (error) {
        console.error("Error deleting bill:", error);
        res.status(500).json({ error: "Failed to delete bill" });
    }
};
