import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import tripRoutes from './routes/trips';
import expenseRoutes from './routes/expenses';
import pollRoutes from './routes/polls';
import activityRoutes from './routes/activities';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/activities', activityRoutes);

app.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`);
});