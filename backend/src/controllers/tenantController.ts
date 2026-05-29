import { Request, Response } from 'express';
import { searchTenantByPhone } from '../services/tenantService';
import { OnboardResidentWorkflow } from '../services/workflows/OnboardResidentWorkflow';
import { VacateResidentWorkflow } from '../services/workflows/VacateResidentWorkflow';
import { lockBed } from '../services/lockService';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { TenantStatus } from '@prisma/client';

export const searchByPhone = async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const tenant = await searchTenantByPhone(phone);
    if (!tenant) {
      return res.status(404).json({ status: 'not_found' });
    }

    res.status(200).json({ status: 'success', data: tenant });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const onboardSchema = z.object({
  bedId: z.string(),
  phone: z.string().min(10),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  moveInDate: z.string(),
  monthlyRent: z.number().positive(),
  securityDeposit: z.number().nonnegative(),
  isQuickAdd: z.boolean().default(false),
  kycDocUrl: z.string().optional(),
  bypassEmailCheck: z.boolean().optional(),
  transferResident: z.boolean().optional()
});

export const onboard = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const actorId = (req as any).auth?.userId || 'system';
    const payload = onboardSchema.parse(req.body);

    // Pre-flight database check to see if the bed is already occupied by an active, notice, or incomplete profile
    const activeProfile = await prisma.pGTenantProfile.findFirst({
      where: {
        bedId: payload.bedId,
        status: {
          in: [TenantStatus.ACTIVE, TenantStatus.INCOMPLETE, TenantStatus.NOTICE]
        }
      }
    });

    if (activeProfile) {
      return res.status(409).json({ error: 'Bed already occupied. Refresh occupancy map.' });
    }

    const profile = await OnboardResidentWorkflow.execute(
      pgId as string,
      payload.bedId,
      payload.phone,
      payload.name,
      payload.email || undefined,
      new Date(payload.moveInDate),
      payload.monthlyRent,
      payload.securityDeposit,
      actorId,
      payload.isQuickAdd,
      payload.kycDocUrl,
      payload.bypassEmailCheck || false,
      payload.transferResident || false
    );

    res.status(200).json({ status: 'success', data: profile });
  } catch (error: any) {
    if (error.message && error.message.includes('already occupied')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message && error.message.startsWith('WARNING_ACTIVE_OCCUPANCY:')) {
      const parts = error.message.split(':');
      return res.status(200).json({
        status: 'warning',
        code: 'ACTIVE_OCCUPANCY',
        allocation: {
          roomNumber: parts[1],
          bedLabel: parts[2],
          profileId: parts[3]
        }
      });
    }
    if (error.message && error.message.startsWith('WARNING_EMAIL_EXISTS:')) {
      const parts = error.message.split(':');
      return res.status(200).json({
        status: 'warning',
        code: 'EMAIL_EXISTS',
        tenant: {
          id: parts[1],
          name: parts[2],
          phone: parts[3],
          email: parts[4]
        }
      });
    }
    if (error.message && error.message === 'CONFLICT_DIFFERENT_RECORDS') {
      return res.status(409).json({
        error: 'Conflict: Phone number belongs to one resident, while email belongs to another. Automatic merge blocked.'
      });
    }
    res.status(400).json({ error: error.message });
  }
};

export const lockBedForOnboarding = async (req: Request, res: Response) => {
  try {
    const { bedId } = req.params;
    const actorId = (req as any).auth?.userId || 'system';
    
    const success = await lockBed(bedId as string, actorId);
    if (!success) {
      return res.status(409).json({ error: 'Bed is currently locked by another operation.' });
    }

    res.status(200).json({ status: 'success', message: 'Bed locked for 5 minutes.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const vacate = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { tenantId } = req.params;
    const actorId = (req as any).auth?.userId || 'system';

    const profile = await VacateResidentWorkflow.execute(pgId as string, tenantId as string, actorId);

    res.status(200).json({ status: 'success', data: profile });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

