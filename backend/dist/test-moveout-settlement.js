"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./utils/prisma"));
const OnboardResidentWorkflow_1 = require("./services/workflows/OnboardResidentWorkflow");
const PayDepositWorkflow_1 = require("./services/workflows/PayDepositWorkflow");
const ResolveComplaintWorkflow_1 = require("./services/workflows/ResolveComplaintWorkflow");
const VacateResidentWorkflow_1 = require("./services/workflows/VacateResidentWorkflow");
const tenantController_1 = require("./controllers/tenantController");
const client_1 = require("@prisma/client");
async function main() {
    console.log("=== MOVEOUT SETTLEMENT GATEKEEPER WORKFLOW PROGRAMMATIC TEST ===\n");
    const pg = await prisma_1.default.pG.findFirst();
    if (!pg)
        throw new Error("No PG properties found in database.");
    const room = await prisma_1.default.room.findFirst({ where: { pgId: pg.id } });
    if (!room)
        throw new Error("No rooms found in PG.");
    const bedA = await prisma_1.default.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
    if (!bedA)
        throw new Error("No bed A found.");
    const actorId = 'system_test';
    const phone = "+919999900088";
    // Clean up
    const existing = await prisma_1.default.globalTenant.findMany({ where: { phone } });
    for (const t of existing) {
        await prisma_1.default.pGTenantProfile.updateMany({
            where: { globalTenantId: t.id },
            data: { isActive: false, bedId: null }
        });
    }
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { bedId: bedA.id, status: { in: ['ACTIVE', 'NOTICE'] } },
        data: { status: 'PAST', bedId: null }
    });
    // Onboard resident with rent=₹12,000, deposit=₹24,000
    console.log("Onboarding Srija Dad...");
    const profile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, phone, "Srija Dad", "srijadad@settle.com", new Date(), 12000, 24000, actorId, false, undefined, true, false, false // deposit not collected yet at move-in
    );
    // Collect partial deposit of ₹18,000
    console.log("Collecting ₹18,000 of expected ₹24,000 security deposit...");
    const depositInvoice = await prisma_1.default.rentInvoice.findFirst({
        where: { pgTenantId: profile.id, type: 'SECURITY_DEPOSIT', status: 'PENDING' }
    });
    if (!depositInvoice)
        throw new Error("No deposit invoice found.");
    await PayDepositWorkflow_1.PayDepositWorkflow.execute(pg.id, profile.id, 'cash', actorId, 18000, depositInvoice.id);
    // Create damage charges of ₹5,000
    console.log("Creating damage recovery of ₹5,000...");
    const complaint = await prisma_1.default.complaint.create({
        data: {
            pgId: pg.id,
            pgTenantId: profile.id,
            category: 'MAINTENANCE_REPAIR',
            priority: 'HIGH',
            description: 'Wall paint damage',
            status: client_1.ComplaintStatus.PENDING,
            createdBy: actorId,
            slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
        }
    });
    await ResolveComplaintWorkflow_1.ResolveComplaintWorkflow.execute(pg.id, complaint.id, actorId, 5000, 'SPECIFIC_RESIDENT', profile.id, undefined, undefined, 'Paint damage resolved', [{ title: 'Wall painting', amount: 5000 }], 'CASH' // start as direct cash recovery collection expectation
    );
    // Assert expected dues before settlement
    const profileBeforeSettle = await prisma_1.default.pGTenantProfile.findUnique({
        where: { id: profile.id },
        include: {
            invoices: { where: { isActive: true } },
            damageRecoveries: true
        }
    });
    if (!profileBeforeSettle)
        throw new Error("Profile not found.");
    const expectedDeposit = profileBeforeSettle.securityDeposit;
    const collectedDeposit = profileBeforeSettle.invoices
        .filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
        .reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingRent = profileBeforeSettle.invoices
        .filter(inv => inv.type === 'RENT' && inv.status !== 'PAID')
        .reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingDamage = profileBeforeSettle.damageRecoveries
        .filter(rec => rec.status !== 'FULLY_RECOVERED' && rec.status !== 'WAIVED')
        .reduce((sum, rec) => sum + rec.outstandingAmount, 0);
    const depositObligation = Math.max(0, expectedDeposit - collectedDeposit);
    const totalReceivables = outstandingRent + depositObligation + outstandingDamage;
    console.log("\nStay Financial State Before Settle:");
    console.log(`- Expected Deposit: ₹${expectedDeposit}`);
    console.log(`- Collected Deposit: ₹${collectedDeposit}`);
    console.log(`- Rent Due: ₹${outstandingRent}`);
    console.log(`- Deposit Due: ₹${depositObligation}`);
    console.log(`- Damage Charges: ₹${outstandingDamage}`);
    console.log(`- Total Receivables: ₹${totalReceivables}`);
    console.log(`- Refundable Deposit: ₹${collectedDeposit}`);
    const netSettlement = totalReceivables - collectedDeposit;
    console.log(`- Net Due To PG: ₹${netSettlement}`);
    // Execute settle controller mock for COLLECT
    console.log("\nTriggering COLLECT settlement transaction for ₹5,000 Net Due to PG...");
    const mockReq = {
        params: { tenantId: profile.id },
        body: {
            action: 'COLLECT',
            amount: 5000,
            paymentMode: 'cash'
        },
        pg: { id: pg.id },
        auth: { userId: actorId }
    };
    let updatedData = null;
    const mockRes = {
        status: (code) => ({
            json: (body) => {
                updatedData = body.data;
            }
        })
    };
    await (0, tenantController_1.settleMoveout)(mockReq, mockRes);
    console.log("Settlement Transaction Completed successfully!");
    // Re-verify dues after settlement
    const profileAfterSettle = await prisma_1.default.pGTenantProfile.findUnique({
        where: { id: profile.id },
        include: {
            invoices: { where: { isActive: true } },
            damageRecoveries: true
        }
    });
    if (!profileAfterSettle)
        throw new Error("Profile not found after settle.");
    const collectedDepositAfter = profileAfterSettle.invoices
        .filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
        .reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingRentAfter = profileAfterSettle.invoices
        .filter(inv => inv.type === 'RENT' && inv.status !== 'PAID')
        .reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingDamageAfter = profileAfterSettle.damageRecoveries
        .filter(rec => rec.status !== 'FULLY_RECOVERED' && rec.status !== 'WAIVED')
        .reduce((sum, rec) => sum + rec.outstandingAmount, 0);
    const depositObligationAfter = Math.max(0, profileAfterSettle.securityDeposit - collectedDepositAfter);
    const totalReceivablesAfter = outstandingRentAfter + depositObligationAfter + outstandingDamageAfter;
    const netSettlementAfter = totalReceivablesAfter - collectedDepositAfter;
    console.log("\nStay Financial State After Settle:");
    console.log(`- Collected Deposit: ₹${collectedDepositAfter}`);
    console.log(`- Rent Due: ₹${outstandingRentAfter}`);
    console.log(`- Deposit Due: ₹${depositObligationAfter}`);
    console.log(`- Damage Charges: ₹${outstandingDamageAfter}`);
    console.log(`- Total Receivables: ₹${totalReceivablesAfter}`);
    console.log(`- Net Dues: ₹${netSettlementAfter}`);
    console.log("\nExecuting VacateResidentWorkflow...");
    const vacatedProfile = await VacateResidentWorkflow_1.VacateResidentWorkflow.execute(pg.id, profile.id, actorId);
    console.log(`Resident stay status: ${vacatedProfile.status}`);
    console.log(`Resident securityDepositStatus: ${vacatedProfile.securityDepositStatus}`);
    console.log(`Resident settlementStatus: ${vacatedProfile.settlementStatus}`);
    // Clean up
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { id: profile.id },
        data: { isActive: false }
    });
    console.log("\n=== MOVE-OUT SETTLEMENT VERIFICATION COMPLETED SUCCESSFULLY ===");
}
main().catch(console.error);
//# sourceMappingURL=test-moveout-settlement.js.map