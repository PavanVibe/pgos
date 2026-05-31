import Razorpay from 'razorpay';
import prisma from '../../utils/prisma';
import { InvoiceStatus } from '@prisma/client';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = keyId && keySecret ? new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
}) : null;

export class RazorpayService {
  /**
   * Generates a payment link for rent, deposit, or damage recovery.
   * If Razorpay credentials are missing, falls back to a simulated URL for robust test-mode validation.
   */
  static async createPaymentLink(
    type: 'RENT' | 'SECURITY_DEPOSIT' | 'DAMAGE',
    id: string,
    amount: number,
    residentName: string,
    phone: string,
    email: string,
    pgId: string
  ) {
    const referenceId = `ref_${type.toLowerCase()}_${id}_${Date.now()}`;
    const amountInPaise = Math.round(amount * 100);

    let paymentUrl = '';
    let razorpayPaymentLinkId = '';

    if (razorpay) {
      try {
        const link = await razorpay.paymentLink.create({
          amount: amountInPaise,
          currency: 'INR',
          accept_partial: true,
          first_min_partial_amount: 100, // min 1 INR for partial
          reference_id: referenceId,
          description: `${type.replace('_', ' ')} payment for ${residentName}`,
          customer: {
            name: residentName,
            contact: phone.startsWith('+') ? phone : `+91${phone}`,
            email: email || undefined,
          },
          notify: {
            sms: false,
            email: false,
          },
          options: {
            checkout: {
              name: 'PGOS Payments',
            }
          }
        });
        paymentUrl = link.short_url;
        razorpayPaymentLinkId = link.id;
      } catch (err: any) {
        console.error('[RAZORPAY SERVICE ERROR] Live Link Failed, falling back to simulator:', err.message);
        // Fall back to simulator
        paymentUrl = `http://localhost:3000/pay-simulate?referenceId=${referenceId}&amount=${amount}`;
        razorpayPaymentLinkId = `plink_mock_${Math.random().toString(36).substr(2, 9)}`;
      }
    } else {
      // Offline Simulation Mode
      paymentUrl = `http://localhost:3000/pay-simulate?referenceId=${referenceId}&amount=${amount}`;
      razorpayPaymentLinkId = `plink_mock_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Save PaymentLink record to DB
    const savedLink = await prisma.paymentLink.create({
      data: {
        referenceId,
        razorpayPaymentLinkId,
        paymentUrl,
        amount,
        invoiceId: type === 'RENT' || type === 'SECURITY_DEPOSIT' ? id : undefined,
        recoveryId: type === 'DAMAGE' ? id : undefined,
      }
    });

    return savedLink;
  }

  /**
   * Cryptographically validates Razorpay webhook payloads.
   */
  static verifyWebhook(payload: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = hmac.digest('hex');
    return digest === signature;
  }

  /**
   * Fully processes a successful payment under a strict database transaction.
   * Aligns ledgers, handles partial payments without splits, updates stay profiles,
   * creates receipts, and saves audit trails.
   */
  static async processSuccessfulPayment(
    referenceId: string,
    transactionId: string,
    amountPaid: number,
    paymentMethod: string
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Audit Check: Prevent duplicate payment updates
      const existingReceipt = await tx.paymentReceipt.findUnique({
        where: { transactionId }
      });
      if (existingReceipt) {
        console.log(`[RAZORPAY WEBHOOK WARNING] Duplicate transaction ID ${transactionId} skipped.`);
        return existingReceipt;
      }

      // 2. Fetch the corresponding payment link
      const link = await tx.paymentLink.findUnique({
        where: { referenceId },
        include: {
          rentInvoice: { include: { tenantProfile: { include: { globalTenant: true } } } },
          damageRecovery: { include: { tenantProfile: { include: { globalTenant: true } } } }
        }
      });

      if (!link) {
        throw new Error(`PaymentLink with referenceId ${referenceId} not found in database.`);
      }

      // Update link status
      await tx.paymentLink.update({
        where: { id: link.id },
        data: { status: 'paid' }
      });

      let tenantProfileId = '';
      let residentName = '';
      let receiptNumber = `RCP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let invoiceNumberStr = '';

      if (link.invoiceId && link.rentInvoice) {
        const inv = link.rentInvoice;
        tenantProfileId = inv.pgTenantId;
        residentName = inv.tenantProfile.globalTenant.name || 'Resident';
        invoiceNumberStr = `INV-${inv.id.substr(0, 8).toUpperCase()}`;

        const nextPaidAmt = inv.paidAmount + amountPaid;
        const nextStatus = nextPaidAmt >= inv.amount ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

        // Update single invoice without splits or clones
        await tx.rentInvoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: nextPaidAmt,
            status: nextStatus,
            paidAt: new Date(),
            paymentMode: paymentMethod.toUpperCase(),
            referenceId: transactionId,
            razorpayPayId: transactionId,
            razorpayOrdId: link.razorpayPaymentLinkId
          }
        });

        // Handle Security Deposit Updates if applicable
        if (inv.type === 'SECURITY_DEPOSIT') {
          const allPaidDeposits = await tx.rentInvoice.findMany({
            where: { pgTenantId: inv.pgTenantId, type: 'SECURITY_DEPOSIT', status: 'PAID', isActive: true }
          });
          const totalPaid = allPaidDeposits.reduce((sum, d) => sum + d.amount, 0) + (nextStatus === InvoiceStatus.PAID ? 0 : amountPaid);
          
          let newStatus = 'PENDING';
          if (totalPaid >= inv.tenantProfile.securityDeposit) {
            newStatus = 'COLLECTED';
          } else if (totalPaid > 0) {
            newStatus = 'PARTIALLY_PAID';
          }

          await tx.pGTenantProfile.update({
            where: { id: inv.pgTenantId },
            data: {
              securityDepositStatus: newStatus,
              depositCollectedAt: newStatus === 'COLLECTED' || newStatus === 'PARTIALLY_PAID' ? new Date() : null
            }
          });

          // Log Deposit Ledger Transaction
          await tx.depositLedgerTransaction.create({
            data: {
              tenantProfileId: inv.pgTenantId,
              type: 'DEPOSIT_COLLECTED',
              amount: amountPaid,
              reason: `Razorpay Online Payment: ${paymentMethod.toUpperCase()}`,
              createdBy: 'webhook_automation'
            }
          });
        }
      } else if (link.recoveryId && link.damageRecovery) {
        const recovery = link.damageRecovery;
        tenantProfileId = recovery.tenantId;
        residentName = recovery.tenantProfile.globalTenant.name || 'Resident';
        invoiceNumberStr = `REC-${recovery.id.substr(0, 8).toUpperCase()}`;

        const nextRecovered = recovery.recoveredAmount + amountPaid;
        const nextOutstanding = Math.max(0, recovery.totalAmount - nextRecovered);
        const nextStatus = nextOutstanding === 0 ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED';

        await tx.damageRecovery.update({
          where: { id: recovery.id },
          data: {
            recoveredAmount: nextRecovered,
            outstandingAmount: nextOutstanding,
            status: nextStatus,
            collectedDate: new Date(),
            paymentMode: paymentMethod.toUpperCase(),
            referenceNumber: transactionId,
            amountReceived: nextRecovered
          }
        });

        // Log RecoveryTransaction for auditing
        await tx.recoveryTransaction.create({
          data: {
            recoveryId: recovery.id,
            amount: amountPaid,
            paymentMethod: paymentMethod.toUpperCase(),
            referenceNumber: transactionId,
            notes: 'Razorpay Online Webhook Capture',
            createdBy: 'webhook_automation'
          }
        });
      }

      // Create permanent PaymentReceipt
      const receipt = await tx.paymentReceipt.create({
        data: {
          receiptNumber,
          residentName,
          amount: amountPaid,
          paymentMethod: paymentMethod.toUpperCase(),
          transactionId,
          invoiceNumber: invoiceNumberStr,
          tenantProfileId,
          invoiceId: link.invoiceId,
          recoveryId: link.recoveryId
        }
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          actorId: 'webhook_automation',
          action: 'ONLINE_PAYMENT_CAPTURED',
          entityType: link.invoiceId ? 'RentInvoice' : 'DamageRecovery',
          entityId: link.invoiceId || link.recoveryId || '',
          metadata: {
            amountPaid,
            paymentMethod,
            transactionId,
            referenceId,
            receiptNumber
          }
        }
      });

      return receipt;
    });
  }
}
