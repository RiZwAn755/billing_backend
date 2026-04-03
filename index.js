import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import authRouter from './auth/auth.router.js';
import productRouter from './routes/product.router.js';
import billRouter from './routes/bill.router.js';
import expenseRouter from './routes/expense.router.js';
import statsRouter from './routes/stats.router.js';
import settingsRouter from './routes/settings.router.js';
import connectDB from './config/db.js';
import { flushAllCache } from './config/redis.js';

const app = express();
app.use(compression());
app.use(cors({ origin: ['http://localhost:5173', 'https://billing-backend-gamma.vercel.app', 'https://needy-bills.vercel.app'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/bills', billRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);

app.get('/health', (req, res) => {
  res.send('Server is running');
});

// Await the database connection before accepting API requests
connectDB().then(async () => {
  // Flush stale Redis cache on every restart so formula changes take effect
  await flushAllCache();

  // Drop the stale unique index on billNumber if it exists
  try {
    const Bill = (await import('./models/bill.schema.js')).default;
    await Bill.collection.dropIndex('billNumber_1');
    console.log('Dropped stale billNumber_1 index');
  } catch (e) {
    // Index doesn't exist — that's fine
  }
  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });
}).catch(err => {
  console.error('Failed to start server due to DB connection issue', err);
});