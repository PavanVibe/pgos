"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayService = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpay = keyId && keySecret ? new razorpay_1.default({
    key_id: keyId,
    key_secret: keySecret,
}) : null;
class RazorpayService {
    /**
     * Generates a payment link for rent, deposit, or damage recovery.
     * If Razorpay credentials are missing, falls back to a simulated URL for robust test-mode validation.
     */
    static async createPaymentLink(type, id, amount, residentName, phone, email, pgId, frontendUrl, createdBy) {
        const isProd = process.env.NODE_ENV === 'production' && process.env.PAYMENT_MODE !== 'test';
        const appUrl = frontendUrl || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days valid
        const referenceId = `ref_${type.toLowerCase()}_${id}_${Date.now()}`;
        const amountInPaise = Math.round(amount * 100);
        console.log(`[RAZORPAY DIAGNOSTIC] Starting createPaymentLink flow:
    - NODE_ENV: ${process.env.NODE_ENV}
    - PAYMENT_MODE: ${process.env.PAYMENT_MODE}
    - isProd: ${isProd}
    - RAZORPAY_KEY_ID present: ${!!process.env.RAZORPAY_KEY_ID} (Length: ${process.env.RAZORPAY_KEY_ID?.length || 0})
    - RAZORPAY_KEY_SECRET present: ${!!process.env.RAZORPAY_KEY_SECRET} (Length: ${process.env.RAZORPAY_KEY_SECRET?.length || 0})
    - Razorpay Client Initialized: ${!!razorpay}`);
        console.log(`[RAZORPAY DIAGNOSTIC] Inputs:
    - Type: ${type}
    - ID: ${id}
    - Amount: ₹${amount} (Paise: ${amountInPaise})
    - Resident Name: ${residentName}
    - Phone: ${phone}
    - Email: ${email}
    - Reference ID: ${referenceId}`);
        let paymentUrl = '';
        let razorpayPaymentLinkId = '';
        if (razorpay) {
            const payload = {
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
            };
            console.log('[RAZORPAY DIAGNOSTIC] Sending payload to Razorpay:', JSON.stringify(payload, null, 2));
            try {
                console.log('[RAZORPAY DIAGNOSTIC] Initiating paymentLink.create network request to Razorpay API...');
                const createPromise = razorpay.paymentLink.create(payload);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Razorpay API request timed out after 5000ms')), 5000));
                const link = await Promise.race([createPromise, timeoutPromise]);
                console.log('[RAZORPAY DIAGNOSTIC] Razorpay API responded successfully:', JSON.stringify(link, null, 2));
                paymentUrl = link.short_url;
                razorpayPaymentLinkId = link.id;
            }
            catch (err) {
                console.error('[RAZORPAY DIAGNOSTIC ERROR] Live Link Generation Failed:');
                console.error('- Message:', err.message);
                console.error('- Code:', err.code);
                console.error('- StatusCode:', err.statusCode);
                console.error('- Description:', err.description);
                console.error('- Full Error:', JSON.stringify(err, null, 2));
                const detailedError = `Razorpay Link Generation Failed: ${err.message || 'Unknown Error'}. Code: ${err.code || 'N/A'}. Description: ${err.description || 'N/A'}. Status: ${err.statusCode || 'N/A'}.`;
                if (isProd) {
                    throw new Error(detailedError);
                }
                console.log('[RAZORPAY DIAGNOSTIC WARNING] Dev/Test mode active. Falling back to simulator link due to error.');
                // Fall back to simulator
                paymentUrl = `${appUrl}/pay?referenceId=${referenceId}&amount=${amount}`;
                razorpayPaymentLinkId = `plink_mock_${Math.random().toString(36).substr(2, 9)}`;
            }
        }
        else {
            console.log('[RAZORPAY DIAGNOSTIC WARNING] Razorpay Client not initialized because credentials are missing.');
            if (isProd) {
                throw new Error('Razorpay Link Generation Failed: Razorpay Client is not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables.');
            }
            console.log('[RAZORPAY DIAGNOSTIC INFO] Dev/Test mode active. Generating simulator link.');
            // Offline Simulation Mode
            paymentUrl = `${appUrl}/pay?referenceId=${referenceId}&amount=${amount}`;
            razorpayPaymentLinkId = `plink_mock_${Math.random().toString(36).substr(2, 9)}`;
        }
        // Resolve ResidentId (tenantProfileId) dynamically
        let residentId = '';
        if (type === 'RENT' || type === 'SECURITY_DEPOSIT') {
            const inv = await prisma_1.default.rentInvoice.findUnique({ where: { id } });
            if (inv)
                residentId = inv.pgTenantId;
        }
        else if (type === 'DAMAGE') {
            const rec = await prisma_1.default.damageRecovery.findUnique({ where: { id } });
            if (rec)
                residentId = rec.tenantId;
        }
        // Save PaymentLink record to DB
        const savedLink = await prisma_1.default.paymentLink.create({
            data: {
                referenceId,
                razorpayPaymentLinkId,
                paymentUrl,
                amount,
                status: 'ACTIVE',
                expiresAt,
                createdBy: createdBy || 'system',
                residentId: residentId || undefined,
                invoiceId: type === 'RENT' || type === 'SECURITY_DEPOSIT' ? id : undefined,
                recoveryId: type === 'DAMAGE' ? id : undefined,
            }
        });
        return savedLink;
    }
    /**
     * Cryptographically validates Razorpay webhook payloads.
     */
    static verifyWebhook(payload, signature) {
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
    static async processSuccessfulPayment(referenceId, transactionId, amountPaid, paymentMethod, webhookEventId) {
        return await prisma_1.default.$transaction(async (tx) => {
            // 0. Event ID check for absolute duplicate protection
            if (webhookEventId) {
                const logs = await tx.auditLog.findMany({
                    where: { action: 'ONLINE_PAYMENT_CAPTURED' }
                });
                const duplicate = logs.find(log => {
                    const meta = log.metadata;
                    return meta && meta.webhookEventId === webhookEventId;
                });
                if (duplicate) {
                    console.log(`[RAZORPAY WEBHOOK WARNING] Webhook Event ID ${webhookEventId} already processed. Skipping.`);
                    return await tx.paymentReceipt.findFirst({
                        where: { transactionId }
                    });
                }
            }
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
            let tenantProfileId = '';
            let residentName = '';
            let receiptNumber = `RCP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            let invoiceNumberStr = '';
            let resolvedStatus = 'PAID';
            if (link.invoiceId && link.rentInvoice) {
                const inv = link.rentInvoice;
                tenantProfileId = inv.pgTenantId;
                residentName = inv.tenantProfile.globalTenant.name || 'Resident';
                invoiceNumberStr = `INV-${inv.id.substr(0, 8).toUpperCase()}`;
                const nextPaidAmt = inv.paidAmount + amountPaid;
                const nextStatus = nextPaidAmt >= inv.amount ? client_1.InvoiceStatus.PAID : client_1.InvoiceStatus.PARTIALLY_PAID;
                resolvedStatus = nextStatus === client_1.InvoiceStatus.PAID ? 'PAID' : 'PARTIALLY_PAID';
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
                    const totalPaid = allPaidDeposits.reduce((sum, d) => sum + d.amount, 0) + (nextStatus === client_1.InvoiceStatus.PAID ? 0 : amountPaid);
                    let newStatus = 'PENDING';
                    if (totalPaid >= inv.tenantProfile.securityDeposit) {
                        newStatus = 'COLLECTED';
                    }
                    else if (totalPaid > 0) {
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
            }
            else if (link.recoveryId && link.damageRecovery) {
                const recovery = link.damageRecovery;
                tenantProfileId = recovery.tenantId;
                residentName = recovery.tenantProfile.globalTenant.name || 'Resident';
                invoiceNumberStr = `REC-${recovery.id.substr(0, 8).toUpperCase()}`;
                const nextRecovered = recovery.recoveredAmount + amountPaid;
                const nextOutstanding = Math.max(0, recovery.totalAmount - nextRecovered);
                const nextStatus = nextOutstanding === 0 ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED';
                resolvedStatus = nextOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';
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
            // Update the payment link status in database
            await tx.paymentLink.update({
                where: { id: link.id },
                data: { status: resolvedStatus }
            });
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
                        receiptNumber,
                        webhookEventId
                    }
                }
            });
            return receipt;
        });
    }
}
exports.RazorpayService = RazorpayService;
//# sourceMappingURL=razorpayService.js.map