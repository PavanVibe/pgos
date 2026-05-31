import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const basePrisma = new PrismaClient({ adapter });

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const result = await query(args);
        if (model === 'RentInvoice') {
          setImmediate(async () => {
            try {
              const inv = await basePrisma.rentInvoice.findUnique({
                where: { id: result.id },
                include: {
                  tenantProfile: {
                    include: {
                      globalTenant: true
                    }
                  }
                }
              });
              if (inv && inv.status !== 'PAID') {
                const existingLink = await basePrisma.paymentLink.findFirst({
                  where: { invoiceId: inv.id }
                });
                if (!existingLink) {
                  const type = inv.type === 'SECURITY_DEPOSIT' ? 'SECURITY_DEPOSIT' : 'RENT';
                  const amount = inv.amount - inv.paidAmount;
                  if (amount > 0) {
                    const { RazorpayService } = require('../services/payments/razorpayService');
                    await RazorpayService.createPaymentLink(
                      type,
                      inv.id,
                      amount,
                      inv.tenantProfile.globalTenant.name || 'Resident',
                      inv.tenantProfile.globalTenant.phone,
                      inv.tenantProfile.globalTenant.email || '',
                      inv.tenantProfile.pgId
                    );
                    console.log(`[AUTO PAYMENT LINK] Created payment link for invoice ${inv.id}`);
                  }
                }
              }
            } catch (err: any) {
              console.error('[AUTO PAYMENT LINK ERROR]:', err.message);
            }
          });
        } else if (model === 'DamageRecovery') {
          setImmediate(async () => {
            try {
              const rec = await basePrisma.damageRecovery.findUnique({
                where: { id: result.id },
                include: {
                  tenantProfile: {
                    include: {
                      globalTenant: true
                    }
                  }
                }
              });
              if (rec && rec.status !== 'FULLY_RECOVERED' && rec.status !== 'WAIVED') {
                const existingLink = await basePrisma.paymentLink.findFirst({
                  where: { recoveryId: rec.id }
                });
                if (!existingLink) {
                  const amount = rec.outstandingAmount;
                  if (amount > 0) {
                    const { RazorpayService } = require('../services/payments/razorpayService');
                    await RazorpayService.createPaymentLink(
                      'DAMAGE',
                      rec.id,
                      amount,
                      rec.tenantProfile.globalTenant.name || 'Resident',
                      rec.tenantProfile.globalTenant.phone,
                      rec.tenantProfile.globalTenant.email || '',
                      rec.pgId
                    );
                    console.log(`[AUTO PAYMENT LINK] Created payment link for recovery ${rec.id}`);
                  }
                }
              }
            } catch (err: any) {
              console.error('[AUTO PAYMENT LINK ERROR FOR DAMAGE]:', err.message);
            }
          });
        }
        return result;
      },
      async findMany({ model, args, query }) {
        if (
          model !== 'EventLog' && 
          model !== 'AuditLog' && 
          model !== 'OnboardingAnalytics' && 
          model !== 'DamageRecovery' && 
          model !== 'DamageRecoveryItem' &&
          model !== 'DepositLedgerTransaction' &&
          model !== 'RecoveryTransaction' &&
          model !== 'StaffSalaryPayment' &&
          model !== 'CleaningChecklist' &&
          model !== 'MonthlyBusinessSnapshot' &&
          model !== 'PaymentLink' &&
          model !== 'PaymentReceipt'
        ) {
          args.where = { isActive: true, ...args.where };
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (
          model !== 'EventLog' && 
          model !== 'AuditLog' && 
          model !== 'OnboardingAnalytics' && 
          model !== 'DamageRecovery' && 
          model !== 'DamageRecoveryItem' &&
          model !== 'DepositLedgerTransaction' &&
          model !== 'RecoveryTransaction' &&
          model !== 'StaffSalaryPayment' &&
          model !== 'CleaningChecklist' &&
          model !== 'MonthlyBusinessSnapshot' &&
          model !== 'PaymentLink' &&
          model !== 'PaymentReceipt'
        ) {
          args.where = { isActive: true, ...args.where };
        }
        return query(args);
      },
      async count({ model, args, query }) {
        if (
          model !== 'EventLog' && 
          model !== 'AuditLog' && 
          model !== 'OnboardingAnalytics' && 
          model !== 'DamageRecovery' && 
          model !== 'DamageRecoveryItem' &&
          model !== 'DepositLedgerTransaction' &&
          model !== 'RecoveryTransaction' &&
          model !== 'StaffSalaryPayment' &&
          model !== 'CleaningChecklist' &&
          model !== 'MonthlyBusinessSnapshot' &&
          model !== 'PaymentLink' &&
          model !== 'PaymentReceipt'
        ) {
          args.where = { isActive: true, ...args.where };
        }
        return query(args);
      }
    }
  }
});

export default prisma;
