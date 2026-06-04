"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./utils/prisma"));
const PayRentWorkflow_1 = require("./services/workflows/PayRentWorkflow");
const PayDepositWorkflow_1 = require("./services/workflows/PayDepositWorkflow");
const OnboardResidentWorkflow_1 = require("./services/workflows/OnboardResidentWorkflow");
const collectionsController_1 = require("./controllers/collectionsController");
async function main() {
    console.log("=== UNIVERSAL COLLECTIONS COMMAND CENTER TEST SUITE ===\n");
    const pg = await prisma_1.default.pG.findFirst();
    if (!pg)
        throw new Error("No PG properties found in database.");
    const room = await prisma_1.default.room.findFirst({ where: { pgId: pg.id } });
    if (!room)
        throw new Error("No rooms found in PG.");
    const bedA = await prisma_1.default.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
    if (!bedA)
        throw new Error("No bed A found in room.");
    const actorId = 'system_test';
    // 1. Clean up old test tenants
    const testPhone = "+919999999888";
    const existingTenants = await prisma_1.default.globalTenant.findMany({ where: { phone: testPhone } });
    for (const t of existingTenants) {
        await prisma_1.default.pGTenantProfile.updateMany({
            where: { globalTenantId: t.id },
            data: { isActive: false, bedId: null }
        });
    }
    // Ensure bed is free
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { bedId: bedA.id, status: { in: ['ACTIVE', 'NOTICE'] } },
        data: { status: 'PAST', bedId: null }
    });
    // 2. Onboard tenant
    console.log("Onboarding test resident...");
    const profile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pg.id, bedA.id, testPhone, "Collections Tester", "coll@test.com", new Date(), 12000, 15000, actorId, false, undefined, true, false, false // deposit not collected yet
    );
    console.log(`Resident profile created: ${profile.id}`);
    // 3. Settle partial rent via CHEQUE
    console.log("\n--- TEST CASE 1: Settle Partial Rent via CHEQUE ---");
    const rentInvoice = await prisma_1.default.rentInvoice.findFirst({
        where: { pgTenantId: profile.id, type: 'RENT', status: 'PENDING' }
    });
    if (!rentInvoice)
        throw new Error("No pending rent invoice found.");
    console.log(`Rent Invoice Dues: ₹${rentInvoice.amount}`);
    const rentSettleRes = await PayRentWorkflow_1.PayRentWorkflow.execute(pg.id, profile.id, 'cheque', // Cheque payment method!
    actorId, 5000, // ₹5,000 partial payment
    rentInvoice.id, 'CHQ98102830');
    console.log(`Settle Successful!`);
    console.log(`Original invoice status: ${rentSettleRes.status}, amount paid: ₹${rentSettleRes.amount}, mode: ${rentSettleRes.paymentMode}`);
    const childRentInvoice = await prisma_1.default.rentInvoice.findFirst({
        where: { pgTenantId: profile.id, type: 'RENT', razorpayOrdId: `split_parent:${rentInvoice.id}` }
    });
    console.log(`Child invoice generated for outstanding balance: ${!!childRentInvoice}`);
    if (childRentInvoice) {
        console.log(`Outstanding child amount: ₹${childRentInvoice.amount}, status: ${childRentInvoice.status}`);
    }
    // 4. Settle deposit via BANK_TRANSFER
    console.log("\n--- TEST CASE 2: Settle Security Deposit via BANK_TRANSFER ---");
    const depositInvoice = await prisma_1.default.rentInvoice.findFirst({
        where: { pgTenantId: profile.id, type: 'SECURITY_DEPOSIT', status: 'PENDING' }
    });
    if (!depositInvoice)
        throw new Error("No pending deposit invoice found.");
    console.log(`Deposit Invoice Dues: ₹${depositInvoice.amount}`);
    const depositSettleRes = await PayDepositWorkflow_1.PayDepositWorkflow.execute(pg.id, profile.id, 'bank_transfer', // Bank Transfer!
    actorId, 15000, // full settlement
    depositInvoice.id, 'TXN888999');
    console.log(`Settle Successful!`);
    console.log(`Invoice status: ${depositSettleRes.status}, amount paid: ₹${depositSettleRes.amount}, mode: ${depositSettleRes.paymentMode}`);
    const updatedProfile = await prisma_1.default.pGTenantProfile.findUnique({ where: { id: profile.id } });
    console.log(`Tenant securityDepositStatus: ${updatedProfile?.securityDepositStatus}`);
    // 5. Mock collection ledger call to verify new fields
    console.log("\n--- TEST CASE 3: Collections Monthly Ledger Response verification ---");
    const today = new Date();
    const req = {
        params: {
            year: String(today.getFullYear()),
            month: String(today.getMonth())
        },
        query: { type: 'ALL' },
        pg: { id: pg.id }
    };
    let ledgerData = [];
    const res = {
        status: (code) => ({
            json: (body) => {
                ledgerData = body.data;
            }
        })
    };
    await (0, collectionsController_1.getMonthlyCollectionLedger)(req, res);
    console.log(`Ledger entries count: ${ledgerData.length}`);
    const testerEntries = ledgerData.filter(e => e.residentName === "CollectionsTester" || e.residentName === "Collections Tester");
    console.log(`Tester specific entries count: ${testerEntries.length}`);
    for (const entry of testerEntries) {
        console.log(`- Type: ${entry.type}, Status: ${entry.status}, Expected: ₹${entry.amountPaid + entry.dueAmount}, Paid: ₹${entry.amountPaid}, Dues: ₹${entry.dueAmount}`);
        console.log(`  tenantProfileId: ${entry.tenantProfileId}`);
        console.log(`  refundableDeposit: ₹${entry.refundableDeposit}`);
    }
    // Clean up
    await prisma_1.default.pGTenantProfile.updateMany({
        where: { id: profile.id },
        data: { isActive: false }
    });
    console.log("\n=== ALL TEST CASES COMPLETED SUCCESFULLY ===");
}
main().catch(console.error);
//# sourceMappingURL=test-universal-collections.js.map