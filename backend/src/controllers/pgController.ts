import { Request, Response } from 'express';
import { InvoiceStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { allocateBed } from '../services/bedService';
import { z } from 'zod';
import { MonthlyInvoiceService } from '../services/automation/MonthlyInvoiceService';
import { OverdueService } from '../services/automation/OverdueService';
import { WhatsAppService } from '../services/notifications/WhatsAppService';

const createPGSchema = z.object({
  name: z.string().min(3),
  city: z.string(),
  address: z.string().optional()
});

export const createPG = async (req: Request, res: Response) => {
  try {
    const org = (req as any).organization;
    const { name, city, address } = createPGSchema.parse(req.body);

    const pg = await prisma.pG.create({
      data: {
        organizationId: org.id,
        name,
        city,
        address,
        createdBy: (req as any).auth?.userId
      }
    });

    res.status(201).json({ status: 'success', data: pg });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid Request' });
  }
};

export const getOrganizationPGs = async (req: Request, res: Response) => {
  try {
    const org = (req as any).organization;
    
    const pgs = await prisma.pG.findMany({
      where: { organizationId: org.id },
      include: {
        _count: {
          select: { rooms: true, tenantProfiles: true }
        }
      }
    });

    res.status(200).json({ status: 'success', data: pgs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const createRoomSchema = z.object({
  number: z.string(),
  floor: z.string().optional(),
  capacity: z.number().int().positive(),
  monthlyRent: z.number().positive()
});

export const createRoom = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const { number, floor, capacity, monthlyRent } = createRoomSchema.parse(req.body);

    const room = await prisma.$transaction(async (tx) => {
      const newRoom = await tx.room.create({
        data: {
          pgId,
          number,
          floor,
          capacity
        }
      });

      // Generate bed records
      const bedsData = Array.from({ length: capacity }).map((_, idx) => ({
        roomId: newRoom.id,
        bedNumber: `B${idx + 1}`,
        monthlyRent,
        isActive: true
      }));

      await tx.bed.createMany({
        data: bedsData
      });

      return tx.room.findUnique({
        where: { id: newRoom.id },
        include: { beds: true }
      });
    });

    res.status(201).json({ status: 'success', data: room });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid Request' });
  }
};

export const allocateBedController = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { bedId, globalTenantId, securityDeposit, moveInDate } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    const profile = await allocateBed(bedId, globalTenantId, pgId as string, securityDeposit, new Date(moveInDate), actorId);
    
    res.status(200).json({ status: 'success', data: profile });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// --- Operations Integration ---

import { PayRentWorkflow } from '../services/workflows/PayRentWorkflow';
import { RaiseComplaintWorkflow } from '../services/workflows/RaiseComplaintWorkflow';
import { ResolveComplaintWorkflow } from '../services/workflows/ResolveComplaintWorkflow';

/**
 * Fetches all rooms and beds in the PG, including active occupants, to power the onboarding bed grid.
 */
export const getPGRooms = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const rooms = await prisma.room.findMany({
      where: { pgId: pgId as string, isActive: true },
      include: {
        beds: {
          where: { isActive: true },
          include: {
            tenantProfile: {
              where: { status: { in: ['ACTIVE', 'INCOMPLETE', 'NOTICE'] } },
              select: {
                id: true,
                status: true,
                monthlyRent: true,
                securityDeposit: true,
                moveInDate: true,
                globalTenant: {
                  select: {
                    name: true,
                    phone: true,
                    email: true,
                  }
                },
                invoices: {
                  where: {
                    status: { in: ['PENDING', 'PAST_DUE'] }
                  },
                  select: {
                    id: true,
                    amount: true,
                    status: true,
                    dueDate: true
                  }
                },
                complaints: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { number: 'asc' }
    });

    res.status(200).json({ status: 'success', data: rooms });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const payRent = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { tenantId } = req.params;
    const { amount, paidAt, referenceId, invoiceId } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    let paymentMode = req.body.paymentMode;
    if (req.body.method && !req.body.paymentMode) {
      console.warn(`[Deprecation Warning] Deprecated payment payload key "method" detected from actor ${actorId}. Use "paymentMode" instead.`);
      paymentMode = req.body.method;
    }

    if (!paymentMode || (paymentMode !== 'upi' && paymentMode !== 'cash' && paymentMode !== 'bank_transfer' && paymentMode !== 'cheque')) {
      return res.status(400).json({ error: 'Valid payment method (upi/cash/bank_transfer/cheque) is required.' });
    }

    const parsedAmount = amount !== undefined && amount !== null ? parseFloat(amount) : undefined;

    const updatedInvoice = await PayRentWorkflow.execute(
      pgId as string, 
      tenantId as string, 
      paymentMode, 
      actorId, 
      parsedAmount,
      invoiceId as string | undefined,
      referenceId as string | undefined
    );
    res.status(200).json({ status: 'success', data: updatedInvoice });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

import { PayDepositWorkflow } from '../services/workflows/PayDepositWorkflow';

export const payDeposit = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { tenantId } = req.params;
    const { amount, referenceId, invoiceId } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    let paymentMode = req.body.paymentMode;
    if (req.body.method && !req.body.paymentMode) {
      paymentMode = req.body.method;
    }

    if (!paymentMode || (paymentMode !== 'upi' && paymentMode !== 'cash' && paymentMode !== 'bank_transfer' && paymentMode !== 'cheque')) {
      return res.status(400).json({ error: 'Valid payment method (upi/cash/bank_transfer/cheque) is required.' });
    }

    const parsedAmount = amount !== undefined && amount !== null ? parseFloat(amount) : undefined;

    const updatedInvoice = await PayDepositWorkflow.execute(
      pgId as string, 
      tenantId as string, 
      paymentMode, 
      actorId, 
      parsedAmount,
      invoiceId as string | undefined,
      referenceId as string | undefined
    );
    res.status(200).json({ status: 'success', data: updatedInvoice });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const refundDeposit = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { tenantId } = req.params;
    const { refundAmount, paymentMode, refundDate, notes } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    if (!paymentMode || (paymentMode !== 'upi' && paymentMode !== 'cash' && paymentMode !== 'bank_transfer')) {
      return res.status(400).json({ error: 'Valid payment method (upi/cash/bank_transfer) is required.' });
    }

    if (refundAmount === undefined || refundAmount === null || parseFloat(refundAmount) < 0) {
      return res.status(400).json({ error: 'Valid refund amount is required.' });
    }

    const parsedRefundAmount = parseFloat(refundAmount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch tenant profile
      const profile = await tx.pGTenantProfile.findUnique({
        where: { id: tenantId as string },
        include: {
          invoices: {
            where: {
              type: 'SECURITY_DEPOSIT',
              status: 'PAID',
              isActive: true
            }
          }
        }
      });

      if (!profile) {
        throw new Error('Resident stay profile not found.');
      }

      // Compute total collected deposit
      const totalCollectedDeposit = profile.invoices.reduce((sum, inv) => sum + inv.amount, 0);

      // Refund Eligibility: Process Refund button should ONLY be visible when stay status is PAST (HISTORICAL)
      if (profile.status === 'ACTIVE' || profile.status === 'NOTICE') {
        throw new Error('Deposit refunds can only be processed for historical (vacated) residents.');
      }

      if (parsedRefundAmount > totalCollectedDeposit) {
        throw new Error(`Refund amount cannot exceed collected deposit of ₹${totalCollectedDeposit}.`);
      }

      const deductionAmount = Math.max(0, totalCollectedDeposit - parsedRefundAmount);

      // Status mapping based on refundAmount and deduction
      let newStatus = profile.securityDepositStatus;
      if (parsedRefundAmount + deductionAmount >= totalCollectedDeposit) {
        newStatus = 'REFUNDED';
      } else {
        newStatus = 'PARTIALLY_REFUNDED';
      }

      // 2. Update profile
      const updatedProfile = await tx.pGTenantProfile.update({
        where: { id: tenantId as string },
        data: {
          securityDepositStatus: newStatus,
          depositRefundedAmount: parsedRefundAmount,
          depositDeductionAmount: deductionAmount,
          depositRefundedAt: refundDate ? new Date(refundDate) : new Date(),
          depositRefundMode: paymentMode,
          depositRefundNotes: notes || null,
          updatedBy: actorId
        }
      });

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'DEPOSIT_REFUNDED',
          entityType: 'PGTenantProfile',
          entityId: profile.id,
          metadata: {
            pgId,
            tenantId,
            refundAmount: parsedRefundAmount,
            deductionAmount,
            paymentMode,
            notes
          }
        }
      });

      return updatedProfile;
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Creates a new complaint for a PG room/area.
 */
export const createComplaint = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { roomOrArea, description, priority, category } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    if (!roomOrArea || !description || !priority) {
      return res.status(400).json({ error: 'roomOrArea, description, and priority are required.' });
    }

    const complaint = await RaiseComplaintWorkflow.execute(
      pgId as string,
      roomOrArea,
      description,
      priority,
      category,
      actorId
    );

    res.status(200).json({ status: 'success', data: complaint });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Resolves an existing complaint.
 */
export const resolveComplaint = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { complaintId } = req.params;
    const actorId = (req as any).auth?.userId || 'system';

    const {
      repairCost,
      responsibility,
      assignedTenantId,
      billUrl,
      resolvedImageUrl,
      resolutionNotes,
      deductionItems,
      recoveryMethodInput
    } = req.body;

    const updatedComplaint = await ResolveComplaintWorkflow.execute(
      pgId as string,
      complaintId as string,
      actorId,
      repairCost ? parseFloat(repairCost) : undefined,
      responsibility,
      assignedTenantId,
      billUrl,
      resolvedImageUrl,
      resolutionNotes,
      deductionItems,
      recoveryMethodInput
    );
    res.status(200).json({ status: 'success', data: updatedComplaint });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Fetches all complaints for a PG, including resident profile and bed details.
 */
export const getPGComplaints = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const complaints = await prisma.complaint.findMany({
      where: { pgId: pgId as string, isActive: true },
      include: {
        tenantProfile: {
          select: {
            id: true,
            status: true,
            globalTenant: {
              select: {
                name: true,
                phone: true,
                email: true,
              }
            },
            bed: {
              select: {
                bedNumber: true,
                room: {
                  select: {
                    number: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ status: 'success', data: complaints });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Fetches a single complaint by ID.
 */
export const getPGComplaint = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { complaintId } = req.params;
    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId as string, pgId: pgId as string, isActive: true },
      include: {
        tenantProfile: {
          select: {
            id: true,
            status: true,
            globalTenant: {
              select: {
                name: true,
                phone: true,
                email: true,
              }
            },
            bed: {
              select: {
                bedNumber: true,
                room: {
                  select: {
                    number: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    res.status(200).json({ status: 'success', data: complaint });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Fetches comprehensive room operational history ledger (beds, current/past occupants, invoices, complaints, operational timeline, and revenue stats).
 */
export const getRoomHistory = async (req: Request, res: Response) => {
  const pgId = (req as any).pg?.id || req.params.pgId;
  const { roomId } = req.params;
  console.log("pgId", pgId);
  console.log("roomId", roomId);

  let room: any = null;
  try {
    console.log("Starting room fetch...");
    room = await prisma.room.findFirst({
      where: { id: roomId as string, pgId: pgId as string, isActive: true },
      include: {
        beds: {
          where: { isActive: true },
          include: {
            tenantProfile: {
              where: { status: { in: ['ACTIVE', 'INCOMPLETE', 'NOTICE'] } },
              select: {
                id: true,
                status: true,
                monthlyRent: true,
                securityDeposit: true,
                moveInDate: true,
                globalTenant: {
                  select: {
                    name: true,
                    phone: true,
                    email: true,
                  }
                }
              }
            }
          }
        }
      }
    });
    console.log("room exists", room);
  } catch (err: any) {
    console.error("Error during room fetch:", err);
    return res.status(400).json({ error: `Room fetch failure: ${err.message}` });
  }

  if (!room) {
    return res.status(404).json({ error: 'Room not found or does not belong to this PG.' });
  }

  let profiles: any[] = [];
  try {
    console.log("Starting profiles fetch...");
    profiles = await prisma.pGTenantProfile.findMany({
      where: { roomId: roomId as string, pgId: pgId as string, isActive: true },
      include: {
        globalTenant: {
          select: {
            name: true,
            phone: true,
            email: true
          }
        },
        bed: {
          select: {
            bedNumber: true
          }
        },
        invoices: {
          where: { isActive: true },
          orderBy: { dueDate: 'asc' }
        },
        complaints: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log("profiles", profiles?.length);
  } catch (err: any) {
    console.error("Error during profiles fetch:", err);
    return res.status(400).json({ error: `Profiles fetch failure: ${err.message}` });
  }

  let eventLogs: any[] = [];
  try {
    console.log("Starting event logs fetch...");
    const profileIds = profiles.map((p: any) => p.id);
    const invoiceIds = profiles.flatMap((p: any) => p.invoices.map((inv: any) => inv.id));
    const complaintIds = profiles.flatMap((p: any) => p.complaints.map((c: any) => c.id));

    eventLogs = await prisma.eventLog.findMany({
      where: {
        entityId: {
          in: [...profileIds, ...invoiceIds, ...complaintIds]
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log("eventLogs", eventLogs?.length);
  } catch (err: any) {
    console.error("Error during event logs fetch:", err);
    return res.status(400).json({ error: `Event logs fetch failure: ${err.message}` });
  }

  // 4. Calculate Billing and Revenue Stats
  let totalBilled = 0;
  let totalCollected = 0;
  let totalDues = 0;
  try {
    console.log("Starting finance stats calculation...");
    profiles.forEach((profile) => {
      profile.invoices.forEach((inv: any) => {
        totalBilled += inv.amount;
        if (inv.status === 'PAID') {
          totalCollected += inv.amount;
        } else {
          totalDues += inv.amount;
        }
      });
    });
  } catch (err: any) {
    console.error("Error during finance calculation:", err);
    return res.status(400).json({ error: `Finance calculation failure: ${err.message}` });
  }

  // 5. Build Unified Timeline
  let timelineItems: any[] = [];
  try {
    console.log("timeline build start");
    timelineItems = eventLogs.map((log) => {
      let type = 'general';
      let title = log.eventType;
      let description = '';

      const metadata = log.metadata as any || {};

      const invoice = profiles.flatMap((p) => p.invoices).find((i) => i.id === log.entityId);
      const complaint = profiles.flatMap((p) => p.complaints).find((c) => c.id === log.entityId);
      const profile = profiles.find((p) => 
        p.id === log.entityId || 
        (invoice && p.id === invoice.pgTenantId) ||
        (complaint && p.id === complaint.pgTenantId)
      );

      const residentName = profile?.globalTenant?.name || 'Resident';
      const bedObj = room.beds.find((b: any) => b.id === metadata.bedId);
      const resolvedBedNum = profile?.bed?.bedNumber || profile?.historicalBedNumber || bedObj?.bedNumber || 'N/A';

      if (log.eventType === 'TENANT_MOVED_IN' || log.eventType === 'BED_ALLOCATED') {
        type = 'onboarding';
        title = 'Resident Onboarded';
        description = `${residentName} onboarded to Bed ${resolvedBedNum}`;
      } else if (log.eventType === 'TENANT_MOVED_OUT' || log.eventType === 'BED_VACATED') {
        type = 'vacate';
        title = 'Resident Vacated';
        description = `${residentName} vacated the bed`;
      } else if (log.eventType === 'RENT_PAID') {
        type = 'payment';
        title = 'Rent Invoice Paid';
        description = `Payment of ₹${invoice?.amount || 'N/A'} received via ${metadata.method || 'cash'}`;
      } else if (log.eventType === 'COMPLAINT_CREATED') {
        type = 'complaint';
        title = 'Complaint Raised';
        description = `[${complaint?.category || 'General'}] ${complaint?.description || ''}`;
      } else if (log.eventType === 'COMPLAINT_RESOLVED') {
        type = 'complaint-resolved';
        title = 'Complaint Resolved';
        description = `Complaint regarding ${complaint?.category || 'General'} has been resolved`;
      }

      return {
        id: log.id,
        type,
        title,
        description,
        timestamp: log.createdAt
      };
    });
  } catch (err: any) {
    console.error("Error during timeline aggregation:", err);
    return res.status(400).json({ error: `Timeline aggregation failure: ${err.message}` });
  }

  return res.status(200).json({
    status: 'success',
    data: {
      room,
      profiles,
      revenue: {
        totalBilled,
        totalCollected,
        totalDues,
        profitability: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0
      },
      timeline: timelineItems
    }
  });
};

/**
 * Manually triggers generation of monthly invoices.
 */
export const generateInvoicesManual = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).auth?.userId || 'system-manual';
    const result = await MonthlyInvoiceService.generateMonthlyInvoices(actorId);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Manually triggers overdue scanning and transitions.
 */
export const scanOverdueManual = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).auth?.userId || 'system-manual';
    const result = await OverdueService.scanAndProcessOverdueInvoices(actorId);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Retrieves the prioritized list of overdue residents for dashboard widgets.
 */
export const getOverdueResidentsManual = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { filter } = req.query;
    // Aligned with the expanded Zustand sheet states
    let statusFilter: InvoiceStatus[] = [InvoiceStatus.PAST_DUE];
    if (filter === 'all' || filter === 'chronic') {
      statusFilter = [InvoiceStatus.PENDING, InvoiceStatus.PAST_DUE];
    } else if (filter === 'due-today') {
      statusFilter = [InvoiceStatus.PENDING];
    }

    const result = await OverdueService.getOverdueResidentsList(
      pgId as string, 
      statusFilter, 
      filter as string
    );
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Manually dispatches a WhatsApp reminder and logs standard event audit trails.
 */
export const sendReminderManual = async (req: Request, res: Response) => {
  try {
    const { tenantProfileId, type } = req.body;
    const actorId = (req as any).auth?.userId || 'system-manual';

    if (!tenantProfileId || !type) {
      return res.status(400).json({ error: 'tenantProfileId and type are required.' });
    }

    // 1. Fetch tenant profile details to build message variables
    const profile = await prisma.pGTenantProfile.findUnique({
      where: { id: tenantProfileId as string, isActive: true },
      include: {
        globalTenant: true,
        bed: {
          select: {
            bedNumber: true,
            room: { select: { number: true } }
          }
        },
        invoices: {
          where: { status: 'PAST_DUE', isActive: true },
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Tenant profile not found.' });
    }

    const latestOverdue = profile.invoices[0];
    const amount = latestOverdue ? latestOverdue.amount : 10000; // default/prorated fallback
    
    // Calculate exact difference in calendar days unaligned with timezone shifts
    const todayNormalized = new Date(new Date().setHours(0, 0, 0, 0));
    const dueNormalized = latestOverdue ? new Date(new Date(latestOverdue.dueDate).setHours(0, 0, 0, 0)) : todayNormalized;
    const diffDays = Math.round((dueNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));
    const days = diffDays < 0 ? Math.abs(diffDays).toString() : diffDays.toString();

    const variables = {
      name: profile.globalTenant.name || 'Resident',
      amount: amount.toString(),
      room: profile.bed?.room?.number || profile.historicalRoomNumber || 'N/A',
      bed: profile.bed?.bedNumber || profile.historicalBedNumber || 'N/A',
      days
    };

    // 2. Dispatch reminder using WhatsAppService
    const dispatchResult = await WhatsAppService.sendWhatsAppNotification({
      to: profile.globalTenant.phone,
      templateType: type,
      variables
    });

    // 3. Log RENT_REMINDER_SENT event
    await prisma.eventLog.create({
      data: {
        entityId: profile.id,
        eventType: 'RENT_REMINDER_SENT',
        metadata: {
          pgId: profile.pgId,
          roomId: profile.roomId,
          bedId: profile.bedId,
          amount: amount,
          recipientPhone: profile.globalTenant.phone,
          template: type,
          actorId
        }
      }
    });

    res.status(200).json({ status: 'success', data: { dispatchResult, copy: WhatsAppService.getMessageCopy(type, variables) } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Saves a lightweight tenant note inside the EventLog system.
 */
export const saveTenantNoteManual = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { tenantId } = req.params;
    const { note } = req.body;
    const actorId = (req as any).auth?.userId || 'system-manual';

    if (note === undefined || note === null) {
      return res.status(400).json({ error: 'Note content is required.' });
    }

    // Check if profile exists
    const profile = await prisma.pGTenantProfile.findUnique({
      where: { id: tenantId as string, isActive: true }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Tenant profile not found.' });
    }

    // Log TENANT_NOTE_UPDATED event
    await prisma.eventLog.create({
      data: {
        entityId: profile.id,
        eventType: 'TENANT_NOTE_UPDATED',
        metadata: {
          pgId: profile.pgId,
          note: note.trim(),
          actorId
        }
      }
    });

    res.status(200).json({ status: 'success', message: 'Tenant note updated successfully.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};



