import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', credentials: false }));
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'PGOS API is running.' });
});

import pgRoutes from './routes/pgRoutes';
import tenantRoutes from './routes/tenantRoutes';

app.use('/api/pgs', pgRoutes);
app.use('/api/tenants', tenantRoutes);

import { CronScheduler } from './services/automation/CronScheduler';

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  CronScheduler.init();
});