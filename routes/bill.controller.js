import Bill from "../models/bill.schema.js";

// Helper strictly for business isolation generating unique bill numbers per business
export const getNextBillNumber = async (businessId) => {
    // Basic implementation: Count existing bills for this business and add 1
    const count = await Bill.countDocuments({ businessId });
    return count + 1;
};

export const createBill = async (req, res) => {
    try {
        const billData = req.body;
        billData.businessId = req.user.businessId;
        // billNumber is auto-assigned by the pre-save hook in bill.schema.js

        const bill = new Bill(billData);
        await bill.save();
        res.status(201).json({
            ...bill.toObject(),
            id: bill._id.toString()
        });
    } catch (error) {
        console.error("Error creating bill:", error.message, error.code, error.keyValue);
        res.status(500).json({ error: "Failed to create bill", detail: error.message });
    }
};

export const getBills = async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;
        const bills = await Bill.find({ businessId: req.user.businessId })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .select('billNumber customerName grandTotal date createdAt');
        
        const formattedBills = bills.map(b => ({
            ...b.toObject(),
            id: b._id.toString()
        }));
        res.status(200).json(formattedBills);
    } catch (error) {
        console.error("Error fetching bills:", error);
        res.status(500).json({ error: "Failed to fetch bills" });
    }
};

export const getBillById = async (req, res) => {
    try {
        const { id } = req.params;
        const bill = await Bill.findOne({ _id: id, businessId: req.user.businessId });

        if (!bill) {
            return res.status(404).json({ error: "Bill not found or unauthorized" });
        }
        res.status(200).json({
            ...bill.toObject(),
            id: bill._id.toString()
        });
    } catch (error) {
        console.error("Error fetching bill:", error);
        res.status(500).json({ error: "Failed to fetch bill" });
    }
};

export const updateBill = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const bill = await Bill.findOneAndUpdate(
            { _id: id, businessId: req.user.businessId },
            updates,
            { new: true }
        );

        if (!bill) {
            return res.status(404).json({ error: "Bill not found or unauthorized" });
        }

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

        res.status(200).json({ message: "Bill deleted successfully" });
    } catch (error) {
        console.error("Error deleting bill:", error);
        res.status(500).json({ error: "Failed to delete bill" });
    }
};
