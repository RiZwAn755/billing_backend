import express from 'express';
import { createProduct, getProducts, updateProduct, deleteProduct } from './product.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';
import { cacheMiddleware } from '../middlewares/redis.middleware.js';

const router = express.Router();

// Apply authentication middleware to all product routes
router.use(verifyToken);

router.post('/', createProduct);
router.get('/', cacheMiddleware(req => `products:list:${req.user.businessId}`), getProducts);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
