import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { z } from 'zod';

const createLeadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  source: z.string(),
  interestedRoomId: z.string().optional().nullable(),
  expectedMoveIn: z.string().optional().nullable(),
});

const updateLeadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  interestedRoomId: z.string().optional().nullable(),
  expectedMoveIn: z.string().optional().nullable(),
  status: z.string().optional(),
});

export const getLeads = async (req: Request, res: Response) => {
  try {
    const pgId = ((req as any).pg?.id || req.params.pgId) as string;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const { status } = req.query;

    const whereClause: any = { pgId };
    if (status && typeof status === 'string') {
      whereClause.status = status;
    }

    const leads = await prisma.lead.findMany({
      where: whereClause,
      include: {
        interestedRoom: {
          select: { id: true, number: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ status: 'success', data: leads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createLead = async (req: Request, res: Response) => {
  try {
    const pgId = ((req as any).pg?.id || req.params.pgId) as string;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const { name, phone, source, interestedRoomId, expectedMoveIn } = createLeadSchema.parse(req.body);

    const lead = await prisma.lead.create({
      data: {
        pgId,
        name,
        phone,
        source,
        interestedRoomId: interestedRoomId || null,
        expectedMoveIn: expectedMoveIn ? new Date(expectedMoveIn) : null,
        status: 'NEW_LEAD',
      },
      include: {
        interestedRoom: {
          select: { id: true, number: true }
        }
      }
    });

    res.status(201).json({ status: 'success', data: lead });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateLead = async (req: Request, res: Response) => {
  try {
    const pgId = ((req as any).pg?.id || req.params.pgId) as string;
    const leadId = req.params.leadId as string;

    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const validated = updateLeadSchema.parse(req.body);
    
    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.phone !== undefined) updateData.phone = validated.phone;
    if (validated.source !== undefined) updateData.source = validated.source;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.interestedRoomId !== undefined) updateData.interestedRoomId = validated.interestedRoomId;
    if (validated.expectedMoveIn !== undefined) {
      updateData.expectedMoveIn = validated.expectedMoveIn ? new Date(validated.expectedMoveIn) : null;
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        interestedRoom: {
          select: { id: true, number: true }
        }
      }
    });

    res.status(200).json({ status: 'success', data: lead });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteLead = async (req: Request, res: Response) => {
  try {
    const leadId = req.params.leadId as string;

    await prisma.lead.delete({
      where: { id: leadId }
    });

    res.status(200).json({ status: 'success', message: 'Lead deleted successfully.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
