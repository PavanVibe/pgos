import { Request, Response } from 'express';
import { getPGDashboardSummary } from '../services/dashboardService';

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const org = (req as any).organization;
    const pgId = (req as any).pg?.id || req.params.pgId;

    const summary = await getPGDashboardSummary(pgId as string, org.id);

    res.status(200).json({ status: 'success', data: summary });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
