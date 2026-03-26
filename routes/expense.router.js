import express from 'express';
import { createExpense, getExpenses, updateExpense, deleteExpense } from './expense.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';
import { cacheMiddleware } from '../middlewares/redis.middleware.js';

const router = express.Router();

// Apply authentication middleware to all expense routes
router.use(verifyToken);

router.post('/', createExpense);
router.get('/', cacheMiddleware(req => `expenses:list:${req.user.businessId}:${req.query.limit || 50}:${req.query.skip || 0}`), getExpenses);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
