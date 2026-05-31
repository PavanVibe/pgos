import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { z } from 'zod';

const createExpenseSchema = z.object({
  title: z.string().min(1).default('Expense'),
  amount: z.number().positive(),
  category: z.string().min(1),
  incurredAt: z.string().optional().transform(val => val ? new Date(val) : new Date()),
  notes: z.string().optional(),
  receiptUrl: z.string().optional()
});

export const addExpense = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const actorId = (req as any).auth?.userId || 'system';
    const payload = createExpenseSchema.parse(req.body);

    const expense = await prisma.expense.create({
      data: {
        pgId: pgId as string,
        title: payload.title,
        amount: payload.amount,
        category: payload.category.toUpperCase(),
        incurredAt: payload.incurredAt,
        notes: payload.notes || null,
        receiptUrl: payload.receiptUrl || null,
        createdBy: actorId,
        updatedBy: actorId
      }
    });

    res.status(200).json({ status: 'success', data: expense });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getExpensesTimeline = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;

    const expenses = await prisma.expense.findMany({
      where: {
        pgId: pgId as string,
        isActive: true
      },
      orderBy: {
        incurredAt: 'desc'
      }
    });

    res.status(200).json({ status: 'success', data: expenses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
