import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('connect', () => {
    console.log('✅ Connected to Redis Cloud');
});

redisClient.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err);
});

export const setCache = async (key, value, duration = 86400) => {
    try {
        await redisClient.set(key, JSON.stringify(value), 'EX', duration);
    } catch (err) {
        console.error('Redis Set Error:', err);
    }
};

export const getCache = async (key) => {
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('Redis Get Error:', err);
        return null;
    }
};

export const delCache = async (key) => {
    try {
        await redisClient.del(key);
    } catch (err) {
        console.error('Redis Del Error:', err);
    }
};

export const invalidateBusinessCache = async (businessId) => {
    try {
        // Clear stats, bills, expenses, and products for this business
        const patterns = [
            `stats:*:${businessId}*`,
            `bills:*:${businessId}*`,
            `expenses:*:${businessId}*`,
            `products:*:${businessId}*`
        ];
        
        for (const pattern of patterns) {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        }
        console.log(`🧹 Invalidated all cache keys for business: ${businessId}`);
    } catch (err) {
        console.error('Redis Invalidation  Error:', err);
    }
};

export default redisClient;
