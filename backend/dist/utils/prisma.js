"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const basePrisma = new client_1.PrismaClient({ adapter });
const prisma = basePrisma.$extends({
    query: {
        rentInvoice: {
            async create({ args, query }) {
                const result = await query(args);
                setTimeout(async () => {
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
                                    await RazorpayService.createPaymentLink(type, inv.id, amount, inv.tenantProfile.globalTenant.name || 'Resident', inv.tenantProfile.globalTenant.phone, inv.tenantProfile.globalTenant.email || '', inv.tenantProfile.pgId);
                                    console.log(`[AUTO PAYMENT LINK] Created payment link for invoice ${inv.id}`);
                                }
                            }
                        }
                    }
                    catch (err) {
                        console.error('[AUTO PAYMENT LINK ERROR]:', err.stack || err.message || err);
                    }
                }, 1000);
                return result;
            }
        },
        damageRecovery: {
            async create({ args, query }) {
                const result = await query(args);
                setTimeout(async () => {
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
                                    await RazorpayService.createPaymentLink('DAMAGE', rec.id, amount, rec.tenantProfile.globalTenant.name || 'Resident', rec.tenantProfile.globalTenant.phone, rec.tenantProfile.globalTenant.email || '', rec.pgId);
                                    console.log(`[AUTO PAYMENT LINK] Created payment link for recovery ${rec.id}`);
                                }
                            }
                        }
                    }
                    catch (err) {
                        console.error('[AUTO PAYMENT LINK ERROR FOR DAMAGE]:', err.message);
                    }
                }, 1000);
                return result;
            }
        },
        $allModels: {
            async findMany({ model, args, query }) {
                if (model !== 'EventLog' &&
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
                    model !== 'PaymentReceipt') {
                    args.where = { isActive: true, ...args.where };
                }
                return query(args);
            },
            async findFirst({ model, args, query }) {
                if (model !== 'EventLog' &&
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
                    model !== 'PaymentReceipt') {
                    args.where = { isActive: true, ...args.where };
                }
                return query(args);
            },
            async count({ model, args, query }) {
                if (model !== 'EventLog' &&
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
                    model !== 'PaymentReceipt') {
                    args.where = { isActive: true, ...args.where };
                }
                return query(args);
            }
        }
    }
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map