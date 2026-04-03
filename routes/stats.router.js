import express from 'express';
import { getOverallStats, getProfitAnalytics, getProductAnalytics } from './stats.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';
import { cacheMiddleware } from '../middlewares/redis.middleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/overall', cacheMiddleware(req => `stats:overall:${req.user.businessId}:${req.query.date || 'all'}`), getOverallStats);
router.get('/profit-trend', cacheMiddleware(req => `stats:profit:${req.user.businessId}:${req.query.period || 'month'}:${req.query.date || 'all'}`), getProfitAnalytics);
router.get('/product', cacheMiddleware(req => {
    const productName = req.query.productName || '';
    return `stats:product:${req.user.businessId}:${productName.replace(/\\s+/g, '_').toLowerCase()}:${req.query.date || 'all'}`;
}), getProductAnalytics);

export default router;
