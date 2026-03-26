import express from 'express';
import { createBill, getBills, getBillById, getPublicBillById, updateBill, deleteBill } from './bill.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';
import { cacheMiddleware } from '../middlewares/redis.middleware.js';

const router = express.Router();

router.get('/public/:id', getPublicBillById);

// Apply authentication middleware to all bill routes
router.use(verifyToken);

router.post('/', createBill);
router.get('/', cacheMiddleware(req => `bills:list:${req.user.businessId}:${req.query.limit || 50}:${req.query.skip || 0}`), getBills);
router.get('/:id', getBillById);
router.put('/:id', updateBill);
router.delete('/:id', deleteBill);

export default router;
