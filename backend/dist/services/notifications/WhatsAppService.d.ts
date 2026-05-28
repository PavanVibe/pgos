export interface WhatsAppMessagePayload {
    to: string;
    templateType: 'rent_due_tomorrow' | 'rent_overdue' | 'payment_received' | 'complaint_resolved' | 'move_in_welcome';
    variables: Record<string, string>;
}
export declare class WhatsAppService {
    /**
     * Generates message copy based on human-friendly templates.
     */
    static getMessageCopy(templateType: string, vars: Record<string, string>): string;
    /**
     * Dispatches outbound WhatsApp message.
     * Prints the pre-compiled template payload to the console in development,
     * simulating Twilio or Interakt provider gateways.
     */
    static sendWhatsAppNotification(payload: WhatsAppMessagePayload): Promise<{
        success: boolean;
        messageId: string;
    }>;
}
//# sourceMappingURL=WhatsAppService.d.ts.map