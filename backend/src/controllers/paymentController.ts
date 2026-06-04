import { Request, Response } from 'express';
import { RazorpayService } from '../services/payments/razorpayService';
import prisma from '../utils/prisma';

export const generateLink = async (req: Request, res: Response) => {
  try {
    const { type, id, amount, frontendUrl, forceRegenerate } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    if (!type || !id) {
      return res.status(400).json({ error: 'type and id are required.' });
    }

    // Trace and reuse existing active link if available (and not expired) to prevent multiple duplicate active links
    if (!forceRegenerate) {
      const existing = await prisma.paymentLink.findFirst({
        where: {
          invoiceId: type === 'RENT' || type === 'SECURITY_DEPOSIT' ? id : undefined,
          recoveryId: type === 'DAMAGE' ? id : undefined,
          status: { in: ['ACTIVE', 'PARTIALLY_PAID'] }
        }
      });

      if (existing) {
        // Expiry check
        if (existing.expiresAt && new Date() > existing.expiresAt) {
          await prisma.paymentLink.update({
            where: { id: existing.id },
            data: { status: 'EXPIRED' }
          });
        } else {
          return res.status(200).json({ status: 'success', data: existing });
        }
      }
    } else {
      // Mark any existing active links as CANCELLED for full audit trace
      await prisma.paymentLink.updateMany({
        where: {
          invoiceId: type === 'RENT' || type === 'SECURITY_DEPOSIT' ? id : undefined,
          recoveryId: type === 'DAMAGE' ? id : undefined,
          status: { in: ['ACTIVE', 'PARTIALLY_PAID'] }
        },
        data: { status: 'CANCELLED' }
      });
    }

    let targetAmount = amount;
    let residentName = 'Resident';
    let phone = '';
    let email = '';
    let pgId = '';

    if (type === 'RENT' || type === 'SECURITY_DEPOSIT') {
      const inv = await prisma.rentInvoice.findUnique({
        where: { id },
        include: { tenantProfile: { include: { globalTenant: true } } }
      });
      if (!inv) return res.status(404).json({ error: 'Invoice not found.' });

      pgId = inv.tenantProfile.pgId;
      residentName = inv.tenantProfile.globalTenant.name || 'Resident';
      phone = inv.tenantProfile.globalTenant.phone;
      email = inv.tenantProfile.globalTenant.email || '';
      if (!targetAmount) {
        targetAmount = inv.amount - inv.paidAmount;
      }
    } else if (type === 'DAMAGE') {
      const rec = await prisma.damageRecovery.findUnique({
        where: { id },
        include: { tenantProfile: { include: { globalTenant: true } } }
      });
      if (!rec) return res.status(404).json({ error: 'Damage recovery not found.' });

      pgId = rec.pgId;
      residentName = rec.tenantProfile.globalTenant.name || 'Resident';
      phone = rec.tenantProfile.globalTenant.phone;
      email = rec.tenantProfile.globalTenant.email || '';
      if (!targetAmount) {
        targetAmount = rec.outstandingAmount;
      }
    }

    if (!targetAmount || targetAmount <= 0) {
      return res.status(400).json({ error: 'Remaining outstanding amount is zero.' });
    }

    const savedLink = await RazorpayService.createPaymentLink(
      type,
      id,
      targetAmount,
      residentName,
      phone,
      email,
      pgId,
      frontendUrl,
      actorId
    );

    res.status(200).json({ status: 'success', data: savedLink });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLinkDetails = async (req: Request, res: Response) => {
  try {
    const referenceId = req.params.referenceId as string;
    
    const link = (await prisma.paymentLink.findUnique({
      where: { referenceId },
      include: {
        rentInvoice: { include: { tenantProfile: { include: { globalTenant: true } } } },
        damageRecovery: { include: { tenantProfile: { include: { globalTenant: true } } } }
      }
    })) as any;
    
    if (!link) {
      return res.status(404).json({ error: 'Payment link not found.' });
    }
    
    // Check if associated invoice or damage recovery is already settled/paid
    let isSettled = false;
    let currentStatus = link.status;
    let residentName = 'Resident';
    let typeLabel = 'Outstanding Balance';
    let invoiceNumber = '';
    
    if (link.invoiceId && link.rentInvoice) {
      isSettled = link.rentInvoice.status === 'PAID';
      residentName = link.rentInvoice.tenantProfile.globalTenant.name || 'Resident';
      typeLabel = link.rentInvoice.type === 'SECURITY_DEPOSIT' ? 'Deposit Due' : 'Rent Due';
      invoiceNumber = `INV-${link.rentInvoice.id.substr(0, 8).toUpperCase()}`;
    } else if (link.recoveryId && link.damageRecovery) {
      isSettled = link.damageRecovery.status === 'FULLY_RECOVERED';
      residentName = link.damageRecovery.tenantProfile.globalTenant.name || 'Resident';
      typeLabel = 'Damage Charges';
      invoiceNumber = `REC-${link.damageRecovery.id.substr(0, 8).toUpperCase()}`;
    }
    
    if (isSettled) {
      currentStatus = 'PAID';
      if (link.status !== 'PAID') {
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: { status: 'PAID' }
        });
      }
    } else {
      // Check for Expiration
      if (link.expiresAt && new Date() > link.expiresAt) {
        currentStatus = 'EXPIRED';
        if (link.status !== 'EXPIRED') {
          await prisma.paymentLink.update({
            where: { id: link.id },
            data: { status: 'EXPIRED' }
          });
        }
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        referenceId: link.referenceId,
        razorpayPaymentLinkId: link.razorpayPaymentLinkId,
        paymentUrl: link.paymentUrl,
        amount: link.amount,
        status: currentStatus,
        expiresAt: link.expiresAt,
        residentName,
        typeLabel,
        invoiceNumber,
        isSettled,
        isExpired: currentStatus === 'EXPIRED',
        invoiceId: link.invoiceId || link.recoveryId
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const webhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    // Cryptographic signature check
    const isValid = RazorpayService.verifyWebhook(rawBody, signature);
    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const event = req.body.event;
    console.log(`[RAZORPAY WEBHOOK EVENT] Received event: ${event}`);

    if (event === 'payment_link.paid' || event === 'payment.captured') {
      let referenceId = '';
      let transactionId = '';
      let amountPaid = 0;
      let paymentMethod = 'UPI';

      if (event === 'payment_link.paid') {
        const plink = req.body.payload.payment_link.entity;
        const payment = req.body.payload.payment.entity;

        referenceId = plink.reference_id;
        transactionId = payment.id;
        amountPaid = payment.amount / 100; // convert paise to INR
        paymentMethod = payment.method || 'UPI';
      } else if (event === 'payment.captured') {
        const payment = req.body.payload.payment.entity;
        transactionId = payment.id;
        amountPaid = payment.amount / 100;
        paymentMethod = payment.method || 'UPI';

        // Extract referenceId from notes or metadata if present
        referenceId = payment.notes?.reference_id || payment.description || '';
      }

      if (referenceId) {
        await RazorpayService.processSuccessfulPayment(
          referenceId,
          transactionId,
          amountPaid,
          paymentMethod,
          req.body.id
        );
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('[RAZORPAY WEBHOOK ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Dev-only simulation endpoint to mock successful Razorpay payment link checkout.
 */
export const simulatePaymentLinkCheckout = async (req: Request, res: Response) => {
  try {
    const { referenceId, transactionId, amountPaid, paymentMethod } = req.body;

    if (!referenceId || !transactionId || !amountPaid) {
      return res.status(400).json({ error: 'referenceId, transactionId, and amountPaid are required.' });
    }

    const receipt = await RazorpayService.processSuccessfulPayment(
      referenceId,
      transactionId,
      parseFloat(amountPaid),
      paymentMethod || 'UPI'
    );

    res.status(200).json({ status: 'success', data: receipt });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Fetch and merge RentInvoices (Rent & Deposit) and DamageRecoveries for a PG
 */
export const getUnifiedPayments = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID is required.' });
    }

    // 1. Fetch Rent & Deposit Invoices
    const rentInvoices = await prisma.rentInvoice.findMany({
      where: {
        tenantProfile: {
          pgId: pgId,
        },
        isActive: true,
      },
      include: {
        tenantProfile: {
          include: {
            globalTenant: true,
            room: true,
            bed: true,
          },
        },
        paymentLinks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    // 2. Fetch Damage Recoveries
    const damageRecoveries = await prisma.damageRecovery.findMany({
      where: {
        pgId: pgId,
      },
      include: {
        tenantProfile: {
          include: {
            globalTenant: true,
            room: true,
            bed: true,
          },
        },
        paymentLinks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Map Rent Invoices to Unified Format
    const mappedInvoices = rentInvoices.map((inv) => {
      let unifiedStatus = 'UNPAID';
      if (inv.status === 'PAID') {
        unifiedStatus = 'PAID';
      } else if (inv.status === 'PARTIALLY_PAID') {
        unifiedStatus = 'PARTIAL';
      }

      const activeLink = inv.paymentLinks[0] || null;

      return {
        id: inv.id,
        type: inv.type, // "RENT" or "SECURITY_DEPOSIT"
        amount: inv.amount,
        paidAmount: inv.paidAmount,
        outstandingAmount: Math.max(0, inv.amount - inv.paidAmount),
        dueDate: inv.dueDate,
        createdAt: inv.createdAt,
        status: unifiedStatus,
        originalStatus: inv.status,
        residentName: inv.tenantProfile.globalTenant.name || 'Resident',
        residentPhone: inv.tenantProfile.globalTenant.phone,
        residentId: inv.tenantProfile.id,
        roomNumber: inv.tenantProfile.room.number,
        bedNumber: inv.tenantProfile.bed?.bedNumber || inv.tenantProfile.historicalBedNumber || '-',
        activeLink: activeLink ? {
          referenceId: activeLink.referenceId,
          paymentUrl: activeLink.paymentUrl,
          status: activeLink.status,
          expiresAt: activeLink.expiresAt,
        } : null,
      };
    });

    // 4. Map Damage Recoveries to Unified Format
    const mappedRecoveries = damageRecoveries.map((rec) => {
      let unifiedStatus = 'UNPAID';
      if (rec.status === 'FULLY_RECOVERED' || rec.status === 'WAIVED') {
        unifiedStatus = 'PAID';
      } else if (rec.status === 'PARTIALLY_RECOVERED') {
        unifiedStatus = 'PARTIAL';
      }

      const activeLink = rec.paymentLinks[0] || null;

      return {
        id: rec.id,
        type: 'DAMAGE',
        amount: rec.amount,
        paidAmount: rec.recoveredAmount || rec.amountReceived || 0,
        outstandingAmount: Math.max(0, rec.outstandingAmount),
        dueDate: rec.createdAt,
        createdAt: rec.createdAt,
        status: unifiedStatus,
        originalStatus: rec.status,
        residentName: rec.tenantProfile.globalTenant.name || 'Resident',
        residentPhone: rec.tenantProfile.globalTenant.phone,
        residentId: rec.tenantProfile.id,
        roomNumber: rec.tenantProfile.room.number,
        bedNumber: rec.tenantProfile.bed?.bedNumber || rec.tenantProfile.historicalBedNumber || '-',
        activeLink: activeLink ? {
          referenceId: activeLink.referenceId,
          paymentUrl: activeLink.paymentUrl,
          status: activeLink.status,
          expiresAt: activeLink.expiresAt,
        } : null,
      };
    });

    const allPayments = [...mappedInvoices, ...mappedRecoveries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.status(200).json({ status: 'success', data: allPayments });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch payments.' });
  }
};
