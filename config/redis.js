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

export const clearStatsCache = async (businessId) => {
    try {
        const keys = await redisClient.keys(`stats:*:${businessId}*`);
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`🧹 Cleared ${keys.length} cache keys for business: ${businessId}`);
        }
    } catch (err) {
        console.error('Redis Clear Cache Error:', err);
    }
};

export default redisClient;
