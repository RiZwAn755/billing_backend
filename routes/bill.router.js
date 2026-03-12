import express from 'express';
import { createBill, getBills, getBillById, updateBill, deleteBill } from './bill.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';

const router = express.Router();

// Apply authentication middleware to all bill routes
router.use(verifyToken);

router.post('/', createBill);
router.get('/', getBills);
router.get('/:id', getBillById);
router.put('/:id', updateBill);
router.delete('/:id', deleteBill);

export default router;
