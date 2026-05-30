"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./utils/prisma"));
const OnboardResidentWorkflow_1 = require("./services/workflows/OnboardResidentWorkflow");
const client_1 = require("@prisma/client");
const collectionsController_1 = require("./controllers/collectionsController");
async function main() {
    console.log("=== DEPOSIT INVOICE SELF-HEALING & ₹0 N/A TEST SUITE ===\n");
    const pg = await prisma_1.default.pG.findFirst();
    if (!pg)
        throw new Error("Please run test-deposit-bug first.");
    const room = await prisma_1.default.room.findFirst({ where: { pgId: pg.id } });
    if (!room)
        throw new Error("No room found.");
    const bedA = await prisma_1.default.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
    if (!bedA)
        throw new Error("No bed A found.");
    // =========================================================================
    // TEST CASE 1: srija mom - expected deposit > 0, status PENDING, but NO invoice exists
    // =========================================================================
    console.log("TEST CASE 1: srija mom (Deposit = ₹24,000, Status = PENDING, but NO invoice in DB)");
    const nameMom = "srija mom (Test Healing)";
    const phoneMom = "+919999977777";
    // Clean old test records
    const oldMom = await prisma_1.default.globalTenant.findMany({ where: { phone: phoneMom } });
    for (const t of oldMom) {
        await prisma_1.default.pGTenantProfile.updateMany({ where: { globalTenantId: t.id }, data: { isActive: false } });
    }
    // Clear bed occupancy
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { bedId: bedA.id, status: { in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.NOTICE] } },
        data: { status: client_1.TenantStatus.PAST, bedId: null }
    });
    // Onboard srija mom
    const profileMom = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, phoneMom, nameMom, "mom@test.com", new Date(), 6000, 24000, "actor_test_123", false, undefined, true, // bypassEmailCheck
    false, false, // depositCollected = false -> will create a pending deposit invoice
    undefined, undefined);
    // Now, to simulate the missing invoice anomaly, let's delete the newly created security deposit invoice!
    console.log("Deleting security deposit invoice to simulate legacy/missing invoice anomaly...");
    const deleteResult = await prisma_1.default.rentInvoice.deleteMany({
        where: {
            pgTenantId: profileMom.id,
            type: 'SECURITY_DEPOSIT'
        }
    });
    console.log(`Deleted ${deleteResult.count} deposit invoice(s).`);
    // Verify invoice is gone
    const countInvoicesBefore = await prisma_1.default.rentInvoice.count({
        where: { pgTenantId: profileMom.id, type: 'SECURITY_DEPOSIT' }
    });
    console.log(`Security deposit invoice count in DB before ledger call: ${countInvoicesBefore}`);
    // =========================================================================
    // TEST CASE 2: Annayya - expected deposit = ₹0, status should resolve to NO_DEPOSIT_REQUIRED
    // =========================================================================
    console.log("\nTEST CASE 2: Annayya (Deposit = ₹0, Status = PENDING, status should resolve to N/A)");
    const nameAnnayya = "Annayya (Test N/A)";
    const phoneAnnayya = "+919999966666";
    // Clean old test records
    const oldAnnayya = await prisma_1.default.globalTenant.findMany({ where: { phone: phoneAnnayya } });
    for (const t of oldAnnayya) {
        await prisma_1.default.pGTenantProfile.updateMany({ where: { globalTenantId: t.id }, data: { isActive: false } });
    }
    // Onboard Annayya with ₹0 deposit
    const profileAnnayya = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, // we don't allocate actually or free it up
    phoneAnnayya, nameAnnayya, "annayya@test.com", new Date(), 6000, 0, // depositAmount = 0
    "actor_test_123", false, undefined, true, // bypassEmailCheck
    false, false, undefined, undefined);
    // Free up bed A
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { id: profileAnnayya.id },
        data: { bedId: null }
    });
    // =========================================================================
    // TRIGGER GETDEPOSITLEDGER & ASSERT
    // =========================================================================
    console.log("\nTriggering getDepositLedger controller to self-heal and normalize...");
    let responseData = null;
    const mockReq = { pg: { id: pg.id } };
    const mockRes = {
        status: (code) => ({
            json: (data) => { responseData = data; }
        })
    };
    await (0, collectionsController_1.getDepositLedger)(mockReq, mockRes);
    const rows = responseData?.data || [];
    const rowMom = rows.find((r) => r.residentName === nameMom);
    const rowAnnayya = rows.find((r) => r.residentName === nameAnnayya);
    console.log(`\nResults:`);
    console.log(`srija mom row:`);
    console.log(`  - status: ${rowMom?.status}`);
    console.log(`  - invoiceId: ${rowMom?.invoiceId}`);
    console.log(`  - pendingAmount: ₹${rowMom?.pendingAmount}`);
    console.log(`Annayya row:`);
    console.log(`  - status: ${rowAnnayya?.status}`);
    console.log(`  - invoiceId: ${rowAnnayya?.invoiceId}`);
    console.log(`  - pendingAmount: ₹${rowAnnayya?.pendingAmount}`);
    // Verify self-healing in database
    const countInvoicesAfter = await prisma_1.default.rentInvoice.count({
        where: { pgTenantId: profileMom.id, type: 'SECURITY_DEPOSIT' }
    });
    console.log(`\nSecurity deposit invoice count in DB after ledger call: ${countInvoicesAfter}`);
    // Assertions
    const passedMom = countInvoicesAfter === 1 && rowMom?.invoiceId !== null && rowMom?.pendingAmount === 24000;
    const passedAnnayya = rowAnnayya?.status === 'NO_DEPOSIT_REQUIRED' && rowAnnayya?.invoiceId === null && rowAnnayya?.pendingAmount === 0;
    const allPassed = passedMom && passedAnnayya;
    console.log(`\nOverall Test Result: ${allPassed ? "PASSED" : "FAILED"}`);
    if (allPassed) {
        console.log(">>> SUCCESS: Legacy invoice self-healed on the fly & ₹0 N/A status processed cleanly! <<<");
    }
    else {
        console.log(">>> FAILURE: Ledger fails to heal missing invoices or N/A values! <<<");
    }
}
main().catch(console.error);
//# sourceMappingURL=test-healing.js.map