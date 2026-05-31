import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { TenantStatus } from '@prisma/client';

export const getVacancyImpact = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;

    // Fetch all active beds in the PG
    const beds = await prisma.bed.findMany({
      where: {
        isActive: true,
        room: {
          pgId: pgId as string,
          isActive: true
        }
      },
      include: {
        tenantProfile: {
          where: {
            status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE, TenantStatus.INCOMPLETE] }
          }
        }
      }
    });

    const totalBeds = beds.length;
    const occupiedBedsList = beds.filter(b => b.tenantProfile !== null);
    const occupiedBeds = occupiedBedsList.length;
    const vacantBedsList = beds.filter(b => b.tenantProfile === null);
    const vacantBeds = vacantBedsList.length;

    // Potential Monthly Revenue Lost = Sum of standard rent of all vacant beds
    const potentialRevenueLost = vacantBedsList.reduce((sum, b) => sum + b.monthlyRent, 0);

    res.status(200).json({
      status: 'success',
      data: {
        totalBeds,
        occupiedBeds,
        vacantBeds,
        potentialRevenueLost
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getFollowUps = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const now = new Date();

    // 1. Fetch overdue Rent invoices
    const unpaidRentInvoices = await prisma.rentInvoice.findMany({
      where: {
        status: { in: ['PENDING', 'PAST_DUE'] },
        isActive: true,
        type: 'RENT',
        tenantProfile: {
          pgId: pgId as string,
          status: { in: ['ACTIVE', 'NOTICE'] }
        }
      },
      include: {
        tenantProfile: {
          include: {
            globalTenant: true,
            room: true
          }
        }
      }
    });

    // 2. Fetch pending deposits
    const pendingDepositTenants = await prisma.pGTenantProfile.findMany({
      where: {
        pgId: pgId as string,
        status: { in: ['ACTIVE', 'NOTICE'] },
        securityDeposit: { gt: 0 },
        NOT: { securityDepositStatus: 'PAID' }
      },
      include: {
        globalTenant: true,
        room: true
      }
    });

    // 3. Fetch outstanding damage recoveries
    const outstandingRecoveries = await prisma.damageRecovery.findMany({
      where: {
        pgId: pgId as string,
        status: { in: ['PENDING', 'PARTIALLY_RECOVERED'] }
      },
      include: {
        tenantProfile: {
          include: {
            globalTenant: true,
            room: true
          }
        }
      }
    });

    const followUps: any[] = [];

    // Map Rent Overdues
    unpaidRentInvoices.forEach(inv => {
      const diffTime = now.getTime() - new Date(inv.dueDate).getTime();
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      followUps.push({
        id: inv.id,
        tenantId: inv.tenantProfile.id,
        type: 'RENT',
        residentName: inv.tenantProfile.globalTenant.name || 'Resident',
        phone: inv.tenantProfile.globalTenant.phone,
        roomNumber: inv.tenantProfile.room.number,
        amount: inv.amount,
        dueDate: inv.dueDate,
        daysOverdue,
        label: 'Rent Due'
      });
    });

    // Map Deposit Overdues
    pendingDepositTenants.forEach(tenant => {
      const diffTime = now.getTime() - new Date(tenant.moveInDate).getTime();
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      followUps.push({
        id: `deposit-${tenant.id}`,
        tenantId: tenant.id,
        type: 'DEPOSIT',
        residentName: tenant.globalTenant.name || 'Resident',
        phone: tenant.globalTenant.phone,
        roomNumber: tenant.room.number,
        amount: tenant.securityDeposit,
        dueDate: tenant.moveInDate,
        daysOverdue,
        label: 'Deposit Due'
      });
    });

    // Map Damage Charges
    outstandingRecoveries.forEach(rec => {
      const diffTime = now.getTime() - new Date(rec.createdAt).getTime();
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      followUps.push({
        id: rec.id,
        tenantId: rec.tenantProfile.id,
        type: 'DAMAGE',
        residentName: rec.tenantProfile.globalTenant.name || 'Resident',
        phone: rec.tenantProfile.globalTenant.phone,
        roomNumber: rec.tenantProfile.room.number,
        amount: rec.outstandingAmount,
        dueDate: rec.createdAt,
        daysOverdue,
        label: 'Damage Charges'
      });
    });

    // Sort by daysOverdue descending (most overdue first)
    followUps.sort((a, b) => b.daysOverdue - a.daysOverdue);

    res.status(200).json({
      status: 'success',
      data: followUps
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCleaningChecklist = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;

    let checklist = await prisma.cleaningChecklist.findUnique({
      where: { pgId: pgId as string }
    });

    if (!checklist) {
      checklist = await prisma.cleaningChecklist.create({
        data: {
          pgId: pgId as string,
          roomsCompleted: false,
          bathroomsCompleted: false,
          commonAreasCompleted: false,
          kitchenCompleted: false,
          waterTankCompleted: false
        }
      });
    }

    res.status(200).json({ status: 'success', data: checklist });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleCleaningChecklist = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { field } = req.body;

    const allowedFields = ['roomsCompleted', 'bathroomsCompleted', 'commonAreasCompleted', 'kitchenCompleted', 'waterTankCompleted'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid cleaning checklist field.' });
    }

    const currentChecklist = await prisma.cleaningChecklist.findUnique({
      where: { pgId: pgId as string }
    });

    const currentValue = currentChecklist ? (currentChecklist as any)[field] : false;

    const updated = await prisma.cleaningChecklist.upsert({
      where: { pgId: pgId as string },
      create: {
        pgId: pgId as string,
        roomsCompleted: field === 'roomsCompleted',
        bathroomsCompleted: field === 'bathroomsCompleted',
        commonAreasCompleted: field === 'commonAreasCompleted',
        kitchenCompleted: field === 'kitchenCompleted',
        waterTankCompleted: field === 'waterTankCompleted'
      },
      update: {
        [field]: !currentValue
      }
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const resetCleaningChecklist = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;

    const updated = await prisma.cleaningChecklist.upsert({
      where: { pgId: pgId as string },
      create: {
        pgId: pgId as string,
        roomsCompleted: false,
        bathroomsCompleted: false,
        commonAreasCompleted: false,
        kitchenCompleted: false,
        waterTankCompleted: false
      },
      update: {
        roomsCompleted: false,
        bathroomsCompleted: false,
        commonAreasCompleted: false,
        kitchenCompleted: false,
        waterTankCompleted: false
      }
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getOperationsSummary = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Rent Due (Unpaid Rent Invoices)
    const unpaidRent = await prisma.rentInvoice.aggregate({
      where: {
        status: { in: ['PENDING', 'PAST_DUE'] },
        isActive: true,
        type: 'RENT',
        tenantProfile: {
          pgId: pgId as string,
          status: { in: ['ACTIVE', 'NOTICE'] }
        }
      },
      _count: { id: true },
      _sum: { amount: true }
    });

    // 2. Deposit Pending (securityDepositStatus !== 'PAID' & securityDeposit > 0)
    const pendingDeposits = await prisma.pGTenantProfile.aggregate({
      where: {
        pgId: pgId as string,
        status: { in: ['ACTIVE', 'NOTICE'] },
        securityDeposit: { gt: 0 },
        NOT: { securityDepositStatus: 'PAID' }
      },
      _count: { id: true },
      _sum: { securityDeposit: true }
    });

    // 3. Damage Recoveries Pending (Outstanding recoveries)
    const pendingRecoveries = await prisma.damageRecovery.aggregate({
      where: {
        pgId: pgId as string,
        status: { in: ['PENDING', 'PARTIALLY_RECOVERED'] }
      },
      _count: { id: true },
      _sum: { outstandingAmount: true }
    });

    // 4. Complaints Pending (PENDING or ESCALATED)
    const pendingComplaints = await prisma.complaint.aggregate({
      where: {
        pgId: pgId as string,
        status: { in: ['PENDING', 'ESCALATED'] },
        isActive: true
      },
      _count: { id: true }
    });

    // 5. Move-Ins this month
    const moveInsCount = await prisma.pGTenantProfile.count({
      where: {
        pgId: pgId as string,
        isActive: true,
        moveInDate: { gte: startOfMonth, lte: endOfMonth }
      }
    });

    // 6. Move-Outs this month
    const moveOutsCount = await prisma.pGTenantProfile.count({
      where: {
        pgId: pgId as string,
        isActive: true,
        status: { in: ['PAST', 'NOTICE'] },
        moveOutDate: { gte: startOfMonth, lte: endOfMonth }
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        rentDueCount: unpaidRent._count.id || 0,
        rentDueAmount: unpaidRent._sum.amount || 0,
        depositPendingCount: pendingDeposits._count.id || 0,
        depositPendingAmount: pendingDeposits._sum.securityDeposit || 0,
        damageRecoveriesCount: pendingRecoveries._count.id || 0,
        damageRecoveriesAmount: pendingRecoveries._sum.outstandingAmount || 0,
        complaintsPendingCount: pendingComplaints._count.id || 0,
        moveInsCount,
        moveOutsCount
      }
    });
  } catch (error: any) {
    res.status(550).json({ error: error.message });
  }
};
