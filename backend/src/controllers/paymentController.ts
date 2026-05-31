import { Request, Response } from 'express';
import { RazorpayService } from '../services/payments/razorpayService';
import prisma from '../utils/prisma';

export const generateLink = async (req: Request, res: Response) => {
  try {
    const { type, id, amount } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    if (!type || !id) {
      return res.status(400).json({ error: 'type and id are required.' });
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
      pgId
    );

    res.status(200).json({ status: 'success', data: savedLink });
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
