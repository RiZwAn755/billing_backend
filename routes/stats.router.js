import express from 'express';
import { getOverallStats, getProfitAnalytics, getProductAnalytics } from './stats.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/overall', getOverallStats);
router.get('/profit-trend', getProfitAnalytics);
router.get('/product', getProductAnalytics);

export default router;
