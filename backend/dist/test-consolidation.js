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
    console.log("=== RESIDENT CONSOLIDATION & PRIORITIZATION TEST SUITE ===\n");
    // Resolve PG
    const pg = await prisma_1.default.pG.findFirst();
    if (!pg)
        throw new Error("Please run test-deposit-bug first to create a demo PG.");
    const room = await prisma_1.default.room.findFirst({ where: { pgId: pg.id } });
    if (!room)
        throw new Error("No room found in demo PG.");
    const bedA = await prisma_1.default.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
    if (!bedA)
        throw new Error("No bed found in room 101.");
    // Clean existing profiles for the diagnostic resident
    const name = "Sriyu (Test Consolidation)";
    const phone = "+919999988888";
    console.log(`Cleaning old test records for ${name}...`);
    const oldTenants = await prisma_1.default.globalTenant.findMany({ where: { phone } });
    for (const tenant of oldTenants) {
        await prisma_1.default.pGTenantProfile.updateMany({
            where: { globalTenantId: tenant.id },
            data: { isActive: false }
        });
    }
    // 1. Create a historical/past stay for Sriyu
    console.log("Creating historical PAST stay for Sriyu...");
    const oldProfile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, phone, name, "sriyu@test.com", new Date("2025-01-01"), 6000, 12000, "actor_test_123", false, undefined, true, // bypassEmailCheck
    false, true, // depositCollected
    "CASH", new Date("2025-01-01"));
    // Set the profile status to PAST and deallocate bed to simulate a vacated resident
    await prisma_1.default.pGTenantProfile.update({
        where: { id: oldProfile.id },
        data: {
            status: client_1.TenantStatus.PAST,
            bedId: null,
            moveOutDate: new Date("2025-05-01")
        }
    });
    // 2. Re-onboard Sriyu for a new active stay!
    console.log("Re-onboarding Sriyu for new ACTIVE stay...");
    // Free up Bed A just in case
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { bedId: bedA.id, status: { in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.NOTICE] } },
        data: { status: client_1.TenantStatus.PAST, bedId: null }
    });
    const activeProfile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, phone, name, "sriyu@test.com", new Date("2026-05-01"), 6500, 13000, "actor_test_123", false, undefined, true, // bypassEmailCheck
    false, false, // depositPending
    undefined, undefined);
    // Verify DB state
    const totalProfiles = await prisma_1.default.pGTenantProfile.findMany({
        where: {
            globalTenant: { phone },
            isActive: true
        },
        include: { room: true, bed: true }
    });
    console.log(`\nVerification of profiles in Database:`);
    console.log(`Total Profiles in DB for Sriyu: ${totalProfiles.length}`);
    for (const p of totalProfiles) {
        console.log(`  - Profile ID: ${p.id}`);
        console.log(`    Status: ${p.status}`);
        console.log(`    Bed Number: ${p.bed?.bedNumber || 'None'}`);
        console.log(`    Move In Date: ${p.moveInDate}`);
    }
    // 3. Mock express request and response to run getDepositLedger
    let responseData = null;
    const mockReq = {
        pg: { id: pg.id }
    };
    const mockRes = {
        status: (code) => {
            return {
                json: (data) => {
                    responseData = data;
                }
            };
        }
    };
    console.log("\nCalling getDepositLedger controller to verify consolidation...");
    await (0, collectionsController_1.getDepositLedger)(mockReq, mockRes);
    const ledgerRows = responseData?.data || [];
    const sriyuRows = ledgerRows.filter((r) => r.residentName === name);
    console.log(`\nLedger Result:`);
    console.log(`Total rows returned for Sriyu in Deposit Ledger: ${sriyuRows.length}`);
    for (const r of sriyuRows) {
        console.log(`  - Row Profile ID: ${r.id}`);
        console.log(`    Room/Bed: Room ${r.roomNumber} (${r.bedNumber})`);
        console.log(`    Status: ${r.status}`);
        console.log(`    Tenant Status (Computed): ${r.tenantStatus}`);
        console.log(`    Pending Amount: ₹${r.pendingAmount}`);
    }
    // Assertions
    const passed = sriyuRows.length === 1 &&
        sriyuRows[0].tenantStatus === 'ACTIVE' &&
        sriyuRows[0].id === activeProfile.id &&
        sriyuRows[0].bedNumber === 'A';
    console.log(`\nConsolidation Test Result: ${passed ? "PASSED" : "FAILED"}`);
    if (passed) {
        console.log(">>> SUCCESS: Active stay was prioritized correctly and old past stay consolidated! <<<");
    }
    else {
        console.log(">>> FAILURE: Ledger contains duplicates or wrong stay prioritization! <<<");
    }
}
main()
    .catch(console.error);
//# sourceMappingURL=test-consolidation.js.map