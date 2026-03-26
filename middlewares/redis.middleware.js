import { getCache } from '../config/redis.js';

export const cacheMiddleware = (keyGenerator) => {
    return async (req, res, next) => {
        try {
            const cacheKey = typeof keyGenerator === 'function' ? keyGenerator(req) : keyGenerator;
            const cachedData = await getCache(cacheKey);
            
            if (cachedData) {
                console.log(`Fetching from cache: ${cacheKey}`);
                return res.status(200).json(cachedData);
            }
            
            req.cacheKey = cacheKey; // Attach cacheKey to req so controllers can use it to setCache
            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
};
