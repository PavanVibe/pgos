import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
// live pipeline force restart v2
// import authRoutes from './routes/authRoutes';
// import pgRoutes from './routes/pgRoutes';
// import tenantRoutes from './routes/tenantRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'PGOS API is running.' });
});

import pgRoutes from './routes/pgRoutes';
import tenantRoutes from './routes/tenantRoutes';

// app.use('/api/auth', authRoutes);
app.use('/api/pgs', pgRoutes);
app.use('/api/tenants', tenantRoutes);

import { CronScheduler } from './services/automation/CronScheduler';

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  CronScheduler.init();
});
