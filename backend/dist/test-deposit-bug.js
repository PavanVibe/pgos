"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./utils/prisma"));
const OnboardResidentWorkflow_1 = require("./services/workflows/OnboardResidentWorkflow");
const VacateResidentWorkflow_1 = require("./services/workflows/VacateResidentWorkflow");
const BedLockService_1 = require("./services/locks/BedLockService");
const client_1 = require("@prisma/client");
async function main() {
    console.log("=== SECURITY DEPOSIT ACCOUNTING VERIFICATION SUITE ===\n");
    // 1. Resolve PG, Room, Bed
    let pg = await prisma_1.default.pG.findFirst();
    if (!pg) {
        console.log("Creating dummy PG for test...");
        const org = await prisma_1.default.organization.upsert({
            where: { clerkOrgId: 'org_test_clerk' },
            update: {},
            create: { name: 'Test Org', clerkOrgId: 'org_test_clerk' }
        });
        pg = await prisma_1.default.pG.create({
            data: { name: 'Test Sunrise PG', city: 'Bangalore', organizationId: org.id }
        });
    }
    console.log(`Using PG: ${pg.name} (${pg.id})`);
    let room = await prisma_1.default.room.findFirst({ where: { pgId: pg.id } });
    if (!room) {
        room = await prisma_1.default.room.create({
            data: { pgId: pg.id, number: '101', capacity: 2 }
        });
    }
    let bedA = await prisma_1.default.bed.findFirst({ where: { roomId: room.id, isActive: true } });
    if (!bedA) {
        bedA = await prisma_1.default.bed.create({
            data: { roomId: room.id, bedNumber: 'A', monthlyRent: 6000 }
        });
    }
    // Ensure bed A is unoccupied
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { bedId: bedA.id, status: { in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.INCOMPLETE, client_1.TenantStatus.NOTICE] } },
        data: { status: client_1.TenantStatus.PAST, bedId: null }
    });
    // =========================================================================
    // TEST CASE A: Deposit Collected (UPI, 29 May 2026)
    // =========================================================================
    console.log("\n------------------------------------------------");
    console.log("TEST CASE A: Deposit Collected (Rent = ₹6,000, Deposit = ₹12,000)");
    console.log("------------------------------------------------");
    const collectDate = new Date("2026-05-29T12:00:00Z");
    const profileA = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, "+919876543210", "John Doe (Test A)", "john.doe@test.com", new Date(), 6000, 12000, "actor_test_123", false, undefined, true, // bypassEmailCheck
    false, true, // depositCollected
    "UPI", // depositPaymentMode
    collectDate // depositCollectedAt
    );
    // Fetch full details with invoices
    const residentA = await prisma_1.default.pGTenantProfile.findUnique({
        where: { id: profileA.id },
        include: { invoices: true }
    });
    if (!residentA)
        throw new Error("Resident A not found after onboarding");
    // Calculations
    const totalRentPaidA = residentA.invoices
        .filter((inv) => inv.type === 'RENT' && inv.status === client_1.InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingRentA = residentA.invoices
        .filter((inv) => inv.type === 'RENT' && inv.status !== client_1.InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amount, 0);
    const securityDepositHeldA = residentA.invoices
        .filter((inv) => inv.type === 'SECURITY_DEPOSIT' && inv.status === client_1.InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingTotalA = residentA.invoices
        .filter((inv) => inv.status !== client_1.InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amount, 0);
    console.log(`- securityDepositStatus: ${residentA.securityDepositStatus}`);
    console.log(`- depositCollectedAt: ${residentA.depositCollectedAt?.toISOString()}`);
    console.log(`- Outstanding Rent: ₹${outstandingRentA}`);
    console.log(`- Deposit Held: ₹${securityDepositHeldA}`);
    console.log(`- Total Outstanding Dues: ₹${outstandingTotalA}`);
    // Assertions Case A
    const passedA = residentA.securityDepositStatus === 'COLLECTED' &&
        outstandingRentA === 6000 &&
        securityDepositHeldA === 12000 &&
        outstandingTotalA === 6000;
    console.log(`\nResult Case A: ${passedA ? "PASSED" : "FAILED"}`);
    // =========================================================================
    // TEST CASE B: Deposit Pending (Unpaid)
    // =========================================================================
    console.log("\n------------------------------------------------");
    console.log("TEST CASE B: Deposit Pending (Rent = ₹6,000, Deposit = ₹12,000)");
    console.log("------------------------------------------------");
    // Vacate resident A to free bed A
    await BedLockService_1.BedLockService.acquireLock(bedA.id, "actor_test_123");
    await prisma_1.default.pGTenantProfile.update({
        where: { id: residentA.id },
        data: { status: client_1.TenantStatus.PAST, bedId: null }
    });
    const profileB = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, "+919876543211", "Jane Smith (Test B)", "jane.smith@test.com", new Date(), 6000, 12000, "actor_test_123", false, undefined, true, // bypassEmailCheck
    false, false, // depositCollected = false
    undefined, undefined);
    const residentB = await prisma_1.default.pGTenantProfile.findUnique({
        where: { id: profileB.id },
        include: { invoices: true }
    });
    if (!residentB)
        throw new Error("Resident B not found after onboarding");
    const outstandingRentB = residentB.invoices
        .filter((inv) => inv.type === 'RENT' && inv.status !== client_1.InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amount, 0);
    const securityDepositHeldB = residentB.invoices
        .filter((inv) => inv.type === 'SECURITY_DEPOSIT' && inv.status === client_1.InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingTotalB = residentB.invoices
        .filter((inv) => inv.status !== client_1.InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amount, 0);
    console.log(`- securityDepositStatus: ${residentB.securityDepositStatus}`);
    console.log(`- depositCollectedAt: ${residentB.depositCollectedAt || 'null'}`);
    console.log(`- Outstanding Rent: ₹${outstandingRentB}`);
    console.log(`- Deposit Held: ₹${securityDepositHeldB}`);
    console.log(`- Total Outstanding Dues: ₹${outstandingTotalB}`);
    // Assertions Case B
    const passedB = residentB.securityDepositStatus === 'PENDING' &&
        outstandingRentB === 6000 &&
        securityDepositHeldB === 0 &&
        outstandingTotalB === 18000;
    console.log(`\nResult Case B: ${passedB ? "PASSED" : "FAILED"}`);
    // =========================================================================
    // TEST CASE C: Vacate stay record preservation
    // =========================================================================
    console.log("\n------------------------------------------------");
    console.log("TEST CASE C: Vacate Stay Record Preservation");
    console.log("------------------------------------------------");
    // Vacate resident B using VacateResidentWorkflow
    await VacateResidentWorkflow_1.VacateResidentWorkflow.execute(pg.id, residentB.id, "actor_test_123");
    const historicalResidentB = await prisma_1.default.pGTenantProfile.findUnique({
        where: { id: residentB.id },
        include: { invoices: true }
    });
    if (!historicalResidentB)
        throw new Error("Historical Resident B not found after vacating");
    console.log(`- Historical Status: ${historicalResidentB.status}`);
    console.log(`- Saved Rent Amount: ₹${historicalResidentB.monthlyRent}`);
    console.log(`- Saved Deposit Amount: ₹${historicalResidentB.securityDeposit}`);
    console.log(`- Saved Deposit Status: ${historicalResidentB.securityDepositStatus}`);
    console.log(`- Invoices preserved count: ${historicalResidentB.invoices.length}`);
    const passedC = historicalResidentB.status === client_1.TenantStatus.PAST &&
        historicalResidentB.monthlyRent === 6000 &&
        historicalResidentB.securityDeposit === 12000 &&
        historicalResidentB.securityDepositStatus === 'PENDING' &&
        historicalResidentB.invoices.length === 2;
    console.log(`\nResult Case C: ${passedC ? "PASSED" : "FAILED"}`);
    console.log("\n=== ALL TEST CASES COMPLETED SUCCESFULLY ===");
    if (passedA && passedB && passedC) {
        console.log(">>> VERIFICATION SUITE: ALL TESTS PASSED MATCHING THE SPECIFICATIONS <<<\n");
    }
    else {
        console.log(">>> VERIFICATION SUITE: SOME TESTS FAILED <<<\n");
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=test-deposit-bug.js.map