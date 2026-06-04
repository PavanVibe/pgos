export declare class RazorpayService {
    /**
     * Generates a payment link for rent, deposit, or damage recovery.
     * If Razorpay credentials are missing, falls back to a simulated URL for robust test-mode validation.
     */
    static createPaymentLink(type: 'RENT' | 'SECURITY_DEPOSIT' | 'DAMAGE', id: string, amount: number, residentName: string, phone: string, email: string, pgId: string, frontendUrl?: string, createdBy?: string): Promise<{
        id: string;
        amount: number;
        status: string;
        referenceId: string;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        recoveryId: string | null;
        razorpayPaymentLinkId: string | null;
        paymentUrl: string | null;
        expiresAt: Date | null;
        residentId: string | null;
        invoiceId: string | null;
    }>;
    /**
     * Cryptographically validates Razorpay webhook payloads.
     */
    static verifyWebhook(payload: string, signature: string): boolean;
    /**
     * Fully processes a successful payment under a strict database transaction.
     * Aligns ledgers, handles partial payments without splits, updates stay profiles,
     * creates receipts, and saves audit trails.
     */
    static processSuccessfulPayment(referenceId: string, transactionId: string, amountPaid: number, paymentMethod: string, webhookEventId?: string): Promise<{
        id: string;
        amount: number;
        status: string;
        createdAt: Date;
        recoveryId: string | null;
        tenantProfileId: string;
        paymentMethod: string;
        paymentDate: Date;
        invoiceId: string | null;
        receiptNumber: string;
        residentName: string;
        transactionId: string;
        invoiceNumber: string | null;
    } | null>;
}
//# sourceMappingURL=razorpayService.d.ts.map