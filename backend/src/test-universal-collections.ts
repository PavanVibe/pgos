import 'dotenv/config';
import prisma from './utils/prisma';
import { PayRentWorkflow } from './services/workflows/PayRentWorkflow';
import { PayDepositWorkflow } from './services/workflows/PayDepositWorkflow';
import { OnboardResidentWorkflow } from './services/workflows/OnboardResidentWorkflow';
import { getMonthlyCollectionLedger } from './controllers/collectionsController';
import { Request, Response } from 'express';

async function main() {
  console.log("=== UNIVERSAL COLLECTIONS COMMAND CENTER TEST SUITE ===\n");

  const pg = await prisma.pG.findFirst();
  if (!pg) throw new Error("No PG properties found in database.");

  const room = await prisma.room.findFirst({ where: { pgId: pg.id } });
  if (!room) throw new Error("No rooms found in PG.");

  const bedA = await prisma.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
  if (!bedA) throw new Error("No bed A found in room.");

  const actorId = 'system_test';

  // 1. Clean up old test tenants
  const testPhone = "+919999999888";
  const existingTenants = await prisma.globalTenant.findMany({ where: { phone: testPhone } });
  for (const t of existingTenants) {
    await prisma.pGTenantProfile.updateMany({
      where: { globalTenantId: t.id },
      data: { isActive: false, bedId: null }
    });
  }

  // Ensure bed is free
  await prisma.pGTenantProfile.updateMany({
    where: { bedId: bedA.id, status: { in: ['ACTIVE', 'NOTICE'] } },
    data: { status: 'PAST', bedId: null }
  });

  // 2. Onboard tenant
  console.log("Onboarding test resident...");
  const profile = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    testPhone,
    "Collections Tester",
    "coll@test.com",
    new Date(),
    12000,
    15000,
    actorId,
    false,
    undefined,
    true,
    false,
    false // deposit not collected yet
  );

  console.log(`Resident profile created: ${profile.id}`);
  
  // 3. Settle partial rent via CHEQUE
  console.log("\n--- TEST CASE 1: Settle Partial Rent via CHEQUE ---");
  const rentInvoice = await prisma.rentInvoice.findFirst({
    where: { pgTenantId: profile.id, type: 'RENT', status: 'PENDING' }
  });
  if (!rentInvoice) throw new Error("No pending rent invoice found.");

  console.log(`Rent Invoice Dues: ₹${rentInvoice.amount}`);
  const rentSettleRes = await PayRentWorkflow.execute(
    pg.id,
    profile.id,
    'cheque', // Cheque payment method!
    actorId,
    5000, // ₹5,000 partial payment
    rentInvoice.id,
    'CHQ98102830'
  );

  console.log(`Settle Successful!`);
  console.log(`Original invoice status: ${rentSettleRes.status}, amount paid: ₹${rentSettleRes.amount}, mode: ${rentSettleRes.paymentMode}`);

  const childRentInvoice = await prisma.rentInvoice.findFirst({
    where: { pgTenantId: profile.id, type: 'RENT', razorpayOrdId: `split_parent:${rentInvoice.id}` }
  });
  console.log(`Child invoice generated for outstanding balance: ${!!childRentInvoice}`);
  if (childRentInvoice) {
    console.log(`Outstanding child amount: ₹${childRentInvoice.amount}, status: ${childRentInvoice.status}`);
  }

  // 4. Settle deposit via BANK_TRANSFER
  console.log("\n--- TEST CASE 2: Settle Security Deposit via BANK_TRANSFER ---");
  const depositInvoice = await prisma.rentInvoice.findFirst({
    where: { pgTenantId: profile.id, type: 'SECURITY_DEPOSIT', status: 'PENDING' }
  });
  if (!depositInvoice) throw new Error("No pending deposit invoice found.");

  console.log(`Deposit Invoice Dues: ₹${depositInvoice.amount}`);
  const depositSettleRes = await PayDepositWorkflow.execute(
    pg.id,
    profile.id,
    'bank_transfer', // Bank Transfer!
    actorId,
    15000, // full settlement
    depositInvoice.id,
    'TXN888999'
  );

  console.log(`Settle Successful!`);
  console.log(`Invoice status: ${depositSettleRes.status}, amount paid: ₹${depositSettleRes.amount}, mode: ${depositSettleRes.paymentMode}`);

  const updatedProfile = await prisma.pGTenantProfile.findUnique({ where: { id: profile.id } });
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
  } as any;

  let ledgerData: any[] = [];
  const res = {
    status: (code: number) => ({
      json: (body: any) => {
        ledgerData = body.data;
      }
    })
  } as any;

  await getMonthlyCollectionLedger(req, res);

  console.log(`Ledger entries count: ${ledgerData.length}`);
  const testerEntries = ledgerData.filter(e => e.residentName === "CollectionsTester" || e.residentName === "Collections Tester");
  console.log(`Tester specific entries count: ${testerEntries.length}`);

  for (const entry of testerEntries) {
    console.log(`- Type: ${entry.type}, Status: ${entry.status}, Expected: ₹${entry.amountPaid + entry.dueAmount}, Paid: ₹${entry.amountPaid}, Dues: ₹${entry.dueAmount}`);
    console.log(`  tenantProfileId: ${entry.tenantProfileId}`);
    console.log(`  refundableDeposit: ₹${entry.refundableDeposit}`);
  }

  // Clean up
  await prisma.pGTenantProfile.updateMany({
    where: { id: profile.id },
    data: { isActive: false }
  });

  console.log("\n=== ALL TEST CASES COMPLETED SUCCESFULLY ===");
}

main().catch(console.error);
