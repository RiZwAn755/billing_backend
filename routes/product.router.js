import express from 'express';
import { createProduct, getProducts, updateProduct, deleteProduct } from './product.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';

const router = express.Router();

// Apply authentication middleware to all product routes
router.use(verifyToken);

router.post('/', createProduct);
router.get('/', getProducts);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
