import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { z } from 'zod';

const createStaffSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  role: z.string().min(1).default('CARETAKER'),
  monthlySalary: z.number().nonnegative().default(0),
  joiningDate: z.string().optional().transform(val => val ? new Date(val) : new Date())
});

const paySalarySchema = z.object({
  amount: z.number().positive(),
  salaryMonth: z.string().min(1), // e.g. "May 2026"
  notes: z.string().optional()
});

export const addStaff = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const orgId = (req as any).auth?.orgId || req.body.organizationId;
    
    // Find organizationId dynamically if not present
    let finalOrgId = orgId;
    if (!finalOrgId) {
      const pg = await prisma.pG.findUnique({ where: { id: pgId as string } });
      finalOrgId = pg?.organizationId;
    }

    if (!finalOrgId) {
      return res.status(400).json({ error: 'Organization context is required.' });
    }

    const payload = createStaffSchema.parse(req.body);

    const staff = await prisma.staff.create({
      data: {
        organizationId: finalOrgId,
        pgId: pgId as string,
        name: payload.name,
        phone: payload.phone,
        role: payload.role.toUpperCase(),
        monthlySalary: payload.monthlySalary,
        joiningDate: payload.joiningDate,
        status: 'ACTIVE'
      }
    });

    res.status(200).json({ status: 'success', data: staff });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getStaffList = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;

    const staff = await prisma.staff.findMany({
      where: {
        pgId: pgId as string,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ status: 'success', data: staff });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deactivateStaff = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;

    const staff = await prisma.staff.update({
      where: { id: staffId as string },
      data: {
        status: 'INACTIVE'
      }
    });

    res.status(200).json({ status: 'success', data: staff });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const payStaffSalary = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const payload = paySalarySchema.parse(req.body);

    const payment = await prisma.staffSalaryPayment.create({
      data: {
        staffId: staffId as string,
        amount: payload.amount,
        salaryMonth: payload.salaryMonth,
        notes: payload.notes || null,
        paymentDate: new Date()
      }
    });

    res.status(200).json({ status: 'success', data: payment });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getStaffDetails = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId as string },
      include: {
        salaryPayments: {
          orderBy: {
            paymentDate: 'desc'
          }
        }
      }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff profile not found.' });
    }

    res.status(200).json({ status: 'success', data: staff });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
