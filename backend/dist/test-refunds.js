"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./utils/prisma"));
const OnboardResidentWorkflow_1 = require("./services/workflows/OnboardResidentWorkflow");
const client_1 = require("@prisma/client");
const pgController_1 = require("./controllers/pgController");
const collectionsController_1 = require("./controllers/collectionsController");
const dashboardService_1 = require("./services/dashboardService");
async function main() {
    console.log("=== SECURITY DEPOSIT REFUND WORKFLOW VERIFICATION SUITE ===\n");
    // 1. Resolve PG context
    const pg = await prisma_1.default.pG.findFirst();
    if (!pg)
        throw new Error("No properties found in database.");
    const room = await prisma_1.default.room.findFirst({ where: { pgId: pg.id } });
    if (!room)
        throw new Error("No room found in demo PG.");
    const bedA = await prisma_1.default.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
    if (!bedA)
        throw new Error("No bed found in room.");
    // Clean existing test profiles
    const phone = "+918888877777";
    const name = "Harsha (Test Refunds)";
    console.log("Cleaning historical test profiles for phone:", phone);
    const oldTenants = await prisma_1.default.globalTenant.findMany({ where: { phone } });
    for (const tenant of oldTenants) {
        await prisma_1.default.pGTenantProfile.updateMany({
            where: { globalTenantId: tenant.id },
            data: { isActive: false }
        });
    }
    // Ensure Bed A is unoccupied
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { bedId: bedA.id, status: { in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.NOTICE] } },
        data: { status: client_1.TenantStatus.PAST, bedId: null }
    });
    // Capture base dashboard stats BEFORE onboarding to ensure relative delta safety
    const initialDashboard = await (0, dashboardService_1.getPGDashboardSummary)(pg.id, pg.organizationId);
    const baseCollected = initialDashboard.collectedDeposits;
    const baseRefunded = initialDashboard.refundedDeposits;
    const baseLiability = initialDashboard.refundLiability;
    const basePendingRefundCount = initialDashboard.pendingRefundResidents;
    console.log(`Captured Initial Base State:`);
    console.log(`- Collected base: ₹${baseCollected}`);
    console.log(`- Refunded base: ₹${baseRefunded}`);
    console.log(`- Liability base: ₹${baseLiability}`);
    console.log(`- Pending base count: ${basePendingRefundCount}`);
    // ------------------------------------------------
    // CASE A: DEPOSIT COLLECTED (₹36,000), NOT REFUNDED
    // ------------------------------------------------
    console.log("\n------------------------------------------------");
    console.log("TEST CASE A: Deposit Collected (Rent = ₹6,000, Deposit = ₹36,000)");
    console.log("------------------------------------------------");
    // Onboard resident as ACTIVE with ₹36,000 deposit collected at move-in
    console.log("Onboarding resident as ACTIVE...");
    const profile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, phone, name, "harsha@refund.com", new Date("2026-05-30"), 6000, 36000, "system_test", false, undefined, true, // bypassEmailCheck
    false, true, // depositCollected
    "UPI", new Date("2026-05-30"));
    console.log("Resident onboarded. Profile ID:", profile.id);
    console.log("Initial Stay Status:", profile.status);
    console.log("Initial Deposit Status:", profile.securityDepositStatus);
    // Assert active resident safeguard: attempt to refund must fail
    console.log("\n[Enforcing Eligibility Safeguard] Attempting refund for ACTIVE resident...");
    let refundError = null;
    const mockReqActive = {
        params: { tenantId: profile.id },
        body: { refundAmount: 36000, paymentMode: 'upi', refundDate: new Date(), notes: 'Test safeguard' },
        pg: { id: pg.id },
        auth: { userId: 'system_test' }
    };
    const mockRes = {
        status: (code) => {
            return {
                json: (data) => {
                    if (code >= 400)
                        refundError = data.error;
                }
            };
        }
    };
    await (0, pgController_1.refundDeposit)(mockReqActive, mockRes);
    if (refundError) {
        console.log(`>>> SUCCESS: Active resident safeguard blocked refund: "${refundError}"`);
    }
    else {
        throw new Error("FAIL: Active resident was allowed to receive a deposit refund!");
    }
    // Move out resident (change status to PAST)
    console.log("\nMoving resident out (Status -> PAST)...");
    const pastProfile = await prisma_1.default.pGTenantProfile.update({
        where: { id: profile.id },
        data: { status: 'PAST', bedId: null, moveOutDate: new Date() }
    });
    // Calculate dashboard summary
    let dashboard = await (0, dashboardService_1.getPGDashboardSummary)(pg.id, pg.organizationId);
    console.log(`\nBefore Refund Dashboard Summary:`);
    console.log(`- Collected Deposits: ₹${dashboard.collectedDeposits} (Base: ₹${baseCollected} + ₹36,000)`);
    console.log(`- Refunded Deposits: ₹${dashboard.refundedDeposits} (Base: ₹${baseRefunded})`);
    console.log(`- Refund Liability: ₹${dashboard.refundLiability} (Base: ₹${baseLiability} + ₹36,000)`);
    console.log(`- Pending Refund Residents: ${dashboard.pendingRefundResidents} (Base: ${basePendingRefundCount} + 1)`);
    if (dashboard.collectedDeposits !== baseCollected + 36000) {
        throw new Error(`FAIL: Collected Deposits is ₹${dashboard.collectedDeposits}, expected ₹${baseCollected + 36000}.`);
    }
    if (dashboard.refundLiability !== baseLiability + 36000) {
        throw new Error(`FAIL: Refund Liability is ₹${dashboard.refundLiability}, expected ₹${baseLiability + 36000}.`);
    }
    if (dashboard.pendingRefundResidents !== basePendingRefundCount + 1) {
        throw new Error(`FAIL: Pending Refund Residents count is ${dashboard.pendingRefundResidents}, expected ${basePendingRefundCount + 1}.`);
    }
    console.log(">>> SUCCESS: Case A Passed. Refund Liability and pending count updated correctly relative to pre-existing data.");
    // ------------------------------------------------
    // CASE B: FULLY REFUNDED (₹36,000)
    // ------------------------------------------------
    console.log("\n------------------------------------------------");
    console.log("TEST CASE B: Full Refund (₹36,000)");
    console.log("------------------------------------------------");
    const mockReqRefundFull = {
        params: { tenantId: profile.id },
        body: { refundAmount: 36000, paymentMode: 'upi', refundDate: new Date(), notes: 'Full settlement' },
        pg: { id: pg.id },
        auth: { userId: 'system_test' }
    };
    console.log("Processing full refund...");
    await (0, pgController_1.refundDeposit)(mockReqRefundFull, mockRes);
    // Fetch updated profile
    const refundedProfile = await prisma_1.default.pGTenantProfile.findUnique({
        where: { id: profile.id }
    });
    console.log("\nAfter Refund Profile Fields:");
    console.log(`- securityDepositStatus: ${refundedProfile?.securityDepositStatus}`);
    console.log(`- depositRefundedAmount: ₹${refundedProfile?.depositRefundedAmount}`);
    console.log(`- depositDeductionAmount: ₹${refundedProfile?.depositDeductionAmount}`);
    console.log(`- depositRefundMode: ${refundedProfile?.depositRefundMode}`);
    console.log(`- depositRefundNotes: ${refundedProfile?.depositRefundNotes}`);
    if (refundedProfile?.securityDepositStatus !== 'REFUNDED') {
        throw new Error(`FAIL: Status is ${refundedProfile?.securityDepositStatus}, expected REFUNDED.`);
    }
    dashboard = await (0, dashboardService_1.getPGDashboardSummary)(pg.id, pg.organizationId);
    console.log(`\nAfter Refund Dashboard Summary:`);
    console.log(`- Collected Deposits: ₹${dashboard.collectedDeposits}`);
    console.log(`- Refunded Deposits: ₹${dashboard.refundedDeposits} (Base: ₹${baseRefunded} + ₹36,000)`);
    console.log(`- Refund Liability: ₹${dashboard.refundLiability} (Base: ₹${baseLiability})`);
    console.log(`- Pending Refund Residents: ${dashboard.pendingRefundResidents} (Base: ${basePendingRefundCount})`);
    if (dashboard.refundedDeposits !== baseRefunded + 36000) {
        throw new Error(`FAIL: Refunded Deposits is ₹${dashboard.refundedDeposits}, expected ₹${baseRefunded + 36000}.`);
    }
    if (dashboard.refundLiability !== baseLiability) {
        throw new Error(`FAIL: Refund Liability is ₹${dashboard.refundLiability}, expected ₹${baseLiability}.`);
    }
    if (dashboard.pendingRefundResidents !== basePendingRefundCount) {
        throw new Error(`FAIL: Pending Refund Residents count is ${dashboard.pendingRefundResidents}, expected ${basePendingRefundCount}.`);
    }
    console.log(">>> SUCCESS: Case B Passed. Refund Liability decreases to initial base liability, status is REFUNDED.");
    // ------------------------------------------------
    // CASE C: DAMAGE DEDUCTION & PARTIAL REFUND
    // ------------------------------------------------
    console.log("\n------------------------------------------------");
    console.log("TEST CASE C: Partial Refund (Collected = ₹12,000, Refunded = ₹10,000, Damage Deduction = ₹2,000)");
    console.log("------------------------------------------------");
    const phoneC = "+917777766666";
    const nameC = "Sumith (Test Partial)";
    console.log("Cleaning and onboarding resident Sumith...");
    const oldTenantsC = await prisma_1.default.globalTenant.findMany({ where: { phone: phoneC } });
    for (const tenant of oldTenantsC) {
        await prisma_1.default.pGTenantProfile.updateMany({
            where: { globalTenantId: tenant.id },
            data: { isActive: false }
        });
    }
    const profileC = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, phoneC, nameC, "sumith@partial.com", new Date("2026-05-30"), 6000, 12000, "system_test", false, undefined, true, // bypassEmailCheck
    false, true, // depositCollected
    "CASH", new Date("2026-05-30"));
    console.log("Sumith onboarded. Moving out...");
    await prisma_1.default.pGTenantProfile.update({
        where: { id: profileC.id },
        data: { status: 'PAST', bedId: null }
    });
    const mockReqPartial = {
        params: { tenantId: profileC.id },
        body: { refundAmount: 10000, paymentMode: 'bank_transfer', refundDate: new Date(), notes: 'Damage to room walls' },
        pg: { id: pg.id },
        auth: { userId: 'system_test' }
    };
    console.log("Processing partial refund (₹10,000 refund of ₹12,000 deposit)...");
    await (0, pgController_1.refundDeposit)(mockReqPartial, mockRes);
    const partialProfile = await prisma_1.default.pGTenantProfile.findUnique({
        where: { id: profileC.id }
    });
    console.log("\nAfter Partial Refund Profile Fields:");
    console.log(`- securityDepositStatus: ${partialProfile?.securityDepositStatus}`);
    console.log(`- depositRefundedAmount: ₹${partialProfile?.depositRefundedAmount}`);
    console.log(`- depositDeductionAmount: ₹${partialProfile?.depositDeductionAmount}`);
    console.log(`- depositRefundNotes: ${partialProfile?.depositRefundNotes}`);
    if (partialProfile?.securityDepositStatus !== 'REFUNDED') {
        throw new Error(`FAIL: Status is ${partialProfile?.securityDepositStatus}, expected REFUNDED.`);
    }
    if (partialProfile?.depositDeductionAmount !== 2000) {
        throw new Error(`FAIL: Deduction amount is ₹${partialProfile?.depositDeductionAmount}, expected ₹2,000.`);
    }
    // Retrieve deposit ledger rows
    let ledgerData = null;
    const mockResLedger = {
        status: (code) => {
            return {
                json: (data) => {
                    ledgerData = data.data;
                }
            };
        }
    };
    await (0, collectionsController_1.getDepositLedger)({ pg: { id: pg.id } }, mockResLedger);
    console.log("\nLedger Verification for Sumith:");
    const sumithRow = ledgerData.find((r) => r.id === profileC.id);
    console.log(`- Resident: ${sumithRow.residentName}`);
    console.log(`- Expected Deposit: ₹${sumithRow.depositAmount}`);
    console.log(`- Collected Amount: ₹${sumithRow.collectedAmount}`);
    console.log(`- Deduction Amount: ₹${sumithRow.deductionAmount}`);
    console.log(`- Refunded Amount: ₹${sumithRow.refundedAmount}`);
    console.log(`- Status: ${sumithRow.status}`);
    console.log(`- Refund Status: ${sumithRow.refundStatus}`);
    console.log(`- Refund Mode & Date: ${sumithRow.refundMode} on ${sumithRow.refundedAt}`);
    if (sumithRow.deductionAmount !== 2000 || sumithRow.refundedAmount !== 10000) {
        throw new Error("FAIL: Ledger columns did not reflect the correct deduction or refund amount.");
    }
    console.log(">>> SUCCESS: Case C Passed. Deduction and refund stored separately, ledger matches specifications.");
    console.log("\n=== ALL SECURITY DEPOSIT REFUND TEST CASES PASSED SUCCESSFULLY ===");
}
main().catch((err) => {
    console.error("FAIL:", err);
    process.exit(1);
});
//# sourceMappingURL=test-refunds.js.map