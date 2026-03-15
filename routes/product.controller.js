import Product from "../models/product.schema.js";
import Expense from "../models/expense.schema.js";
import { getCache, setCache, invalidateBusinessCache } from "../config/redis.js";

export const createProduct = async (req, res) => {
    try {
        const productData = req.body;
        // Inject businessId directly from the validated JWT token payload
        productData.businessId = req.user.businessId;

        const product = new Product(productData);
        await product.save();

        const quantity = Number(product.quantity) || 0;
        const buyingPrice = Number(product.buyingPrice) || 0;

        if (quantity > 0 && buyingPrice > 0) {
            const today = new Date().toISOString().split('T')[0];
            const totalCost = quantity * buyingPrice;

            const expense = new Expense({
                productName: product.name,
                units: quantity,
                costPerUnit: buyingPrice,
                totalCost,
                supplier: '',
                date: today,
                notes: `Auto-added from product purchase: ${product.name}`,
                businessId: req.user.businessId
            });

            try {
                await expense.save();
            } catch (expenseError) {
                await Product.findByIdAndDelete(product._id);
                return res.status(500).json({ error: "Failed to create purchase expense" });
            }
        }

        // Invalidate Cache
        await invalidateBusinessCache(req.user.businessId);

        res.status(201).json({
            ...product.toObject(),
            id: product._id.toString()
        });
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ error: "Failed to create product" });
    }
};

export const getProducts = async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const cacheKey = `products:list:${businessId}`;

        // Try Cache
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            return res.status(200).json(cachedData);
        }

        // Only return products matching the user's businessId
        const products = await Product.find({ businessId }).sort({ createdAt: -1 });
        // Add robust mapping to map MongoDB _id to frontend id requirement dynamically
        const formattedProducts = products.map(p => ({
            ...p.toObject(),
            id: p._id.toString()
        }));

        // Cache for 10 minutes
        await setCache(cacheKey, formattedProducts, 600);

        res.status(200).json(formattedProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Ensure we only update if it belongs to this business
        const product = await Product.findOneAndUpdate(
            { _id: id, businessId: req.user.businessId },
            updates,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ error: "Product not found or unauthorized" });
        }

        // Invalidate Cache
        await invalidateBusinessCache(req.user.businessId);

        res.status(200).json({
             ...product.toObject(),
             id: product._id.toString()
        });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ error: "Failed to update product" });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findOneAndDelete({
            _id: id,
            businessId: req.user.businessId
        });

        if (!product) {
            return res.status(404).json({ error: "Product not found or unauthorized" });
        }

        // Invalidate Cache
        await invalidateBusinessCache(req.user.businessId);

        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
};
