import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './auth/auth.router.js';
import productRouter from './routes/product.router.js';
import billRouter from './routes/bill.router.js';
import expenseRouter from './routes/expense.router.js';
import connectDB from './config/db.js';

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'https://billing-backend-gamma.vercel.app/'], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/bills', billRouter);
app.use('/api/expenses', expenseRouter);

app.get('/health', (req, res) => {
  res.send('Server is running');
});

// Await the database connection before accepting API requests
connectDB().then(() => {
  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });
}).catch(err => {
  console.error('Failed to start server due to DB connection issue', err);
});