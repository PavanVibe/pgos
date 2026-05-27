export interface WhatsAppMessagePayload {
  to: string;
  templateType: 'rent_due_tomorrow' | 'rent_overdue' | 'payment_received' | 'complaint_resolved' | 'move_in_welcome';
  variables: Record<string, string>;
}

export class WhatsAppService {
  /**
   * Generates message copy based on human-friendly templates.
   */
  static getMessageCopy(templateType: string, vars: Record<string, string>): string {
    const name = vars.name || 'Resident';
    const amount = vars.amount || 'N/A';
    const room = vars.room || 'N/A';
    const bed = vars.bed || 'N/A';
    const days = vars.days || '0';
    const category = vars.category || 'General';

    switch (templateType) {
      case 'rent_due_tomorrow':
        return `Hi ${name},\nJust a quick heads-up that your rent of ₹${amount} for Room ${room} Bed ${bed} is due tomorrow. Please clear when possible!`;
      case 'rent_overdue':
        return `Hi ${name},\nYour rent of ₹${amount} for Room ${room} Bed ${bed} is still pending. Please clear when possible.`;
      case 'payment_received':
        return `Hi ${name},\nWe have successfully received your rent payment of ₹${amount}. Thank you!`;
      case 'complaint_resolved':
        return `Hi ${name},\nYour service ticket regarding "${category}" has been resolved. Please let us know if you need anything else.`;
      case 'move_in_welcome':
        return `Hi ${name},\nWelcome to Room ${room} Bed ${bed}! We are excited to host you. Please reach out if you have any questions.`;
      default:
        return `Hi ${name},\nThis is a friendly message regarding your stay in Room ${room}.`;
    }
  }

  /**
   * Dispatches outbound WhatsApp message.
   * Prints the pre-compiled template payload to the console in development,
   * simulating Twilio or Interakt provider gateways.
   */
  static async sendWhatsAppNotification(payload: WhatsAppMessagePayload): Promise<{ success: boolean; messageId: string }> {
    const { to, templateType, variables } = payload;
    const messageText = this.getMessageCopy(templateType, variables);

    console.log(`\n================ WHATSAPP REMINDER DISPATCH ================`);
    console.log(`To: ${to}`);
    console.log(`Template: ${templateType}`);
    console.log(`Message:\n${messageText}`);
    console.log(`============================================================\n`);

    // In a production environment, this would call:
    // await twilioClient.messages.create({ from: 'whatsapp:+14155238886', to: `whatsapp:${to}`, body: messageText });
    
    const mockMessageId = `wa-msg-${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, messageId: mockMessageId };
  }
}
