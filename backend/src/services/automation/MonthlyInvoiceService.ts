import prisma from '../../utils/prisma';

export class MonthlyInvoiceService {
  /**
   * Automatically generates monthly RentInvoices for all ACTIVE/NOTICE tenant profiles.
   * Prevents creating duplicate invoices for the same tenant in the same calendar month.
   */
  static async generateMonthlyInvoices(actorId: string = 'system'): Promise<{ generated: number; skipped: number }> {
    console.log(`[MonthlyInvoiceService] Starting automated monthly invoice generation...`);
    
    // 1. Fetch all active or notice tenant profiles with their beds and parent rooms
    const activeProfiles = await prisma.pGTenantProfile.findMany({
      where: {
        status: { in: ['ACTIVE', 'NOTICE'] },
        isActive: true
      },
      include: {
        bed: true,
        globalTenant: {
          select: { name: true }
        }
      }
    });

    let generatedCount = 0;
    let skippedCount = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Calculate due date (e.g., 5th of current month)
    const dueDate = new Date(currentYear, currentMonth, 5, 23, 59, 59);

    // Range for current calendar month check
    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    for (const profile of activeProfiles) {
      if (!profile.bed) {
        console.log(`[MonthlyInvoiceService] Skipping tenant ${profile.globalTenant.name} (${profile.id}) - No assigned bed.`);
        skippedCount++;
        continue;
      }

      // Check if invoice already exists for this tenant in this calendar month
      const existingInvoice = await prisma.rentInvoice.findFirst({
        where: {
          pgTenantId: profile.id,
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth
          },
          isActive: true
        }
      });

      if (existingInvoice) {
        console.log(`[MonthlyInvoiceService] Skipping tenant ${profile.globalTenant.name} (${profile.id}) - Invoice already exists for this month.`);
        skippedCount++;
        continue;
      }

      // Create new invoice for the monthly rent
      const rentAmount = profile.bed.monthlyRent;
      
      await prisma.$transaction(async (tx) => {
        const invoice = await tx.rentInvoice.create({
          data: {
            pgTenantId: profile.id,
            amount: rentAmount,
            dueDate: dueDate,
            status: 'PENDING',
            createdBy: actorId
          }
        });

        // Log INVOICE_GENERATED event
        await tx.eventLog.create({
          data: {
            entityId: invoice.id,
            eventType: 'INVOICE_GENERATED',
            metadata: {
              pgId: profile.pgId,
              roomId: profile.roomId,
              bedId: profile.bedId,
              amount: rentAmount,
              dueDate: dueDate,
              tenantName: profile.globalTenant.name
            }
          }
        });
      });

      console.log(`[MonthlyInvoiceService] Generated monthly invoice of ₹${rentAmount} for tenant ${profile.globalTenant.name} (${profile.id})`);
      generatedCount++;
    }

    console.log(`[MonthlyInvoiceService] Automated invoice generation completed. Generated: ${generatedCount}, Skipped: ${skippedCount}`);
    return { generated: generatedCount, skipped: skippedCount };
  }
}
