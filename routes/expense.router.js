import express from 'express';
import { createExpense, getExpenses, updateExpense, deleteExpense } from './expense.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';

const router = express.Router();

// Apply authentication middleware to all expense routes
router.use(verifyToken);

router.post('/', createExpense);
router.get('/', getExpenses);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
