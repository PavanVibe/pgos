import { Request, Response } from 'express';
import { OperationalSummaryService } from '../services/OperationalSummaryService';

export const getTasks = async (req: Request, res: Response) => {
  try {
    const { pgId } = req.params;
    const tasks = await OperationalSummaryService.getTasksSummary(pgId as string);
    res.status(200).json({ status: 'success', data: tasks });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getOccupancy = async (req: Request, res: Response) => {
  try {
    const { pgId } = req.params;
    const occupancy = await OperationalSummaryService.getOccupancySummary(pgId as string);
    res.status(200).json({ status: 'success', data: occupancy });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getActivity = async (req: Request, res: Response) => {
  try {
    const { pgId } = req.params;
    const activity = await OperationalSummaryService.getActivityFeed(pgId as string);
    res.status(200).json({ status: 'success', data: activity });
  } catch (error: any) {
    console.error("GET ACTIVITY ERROR:", error);
    res.status(400).json({ error: error.message });
  }
};

