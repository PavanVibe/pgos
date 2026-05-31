import 'dotenv/config';
import prisma from './utils/prisma';
import { OnboardResidentWorkflow } from './services/workflows/OnboardResidentWorkflow';
import { VacateResidentWorkflow } from './services/workflows/VacateResidentWorkflow';
import { settleMoveout } from './controllers/tenantController';
import { TenantStatus } from '@prisma/client';

async function main() {
  console.log("=== MOVEOUT SETTLEMENT REFUND UNLOCK VERIFICATION SUITE ===\n");

  const pg = await prisma.pG.findFirst();
  if (!pg) throw new Error("No PG properties found in database.");

  const room = await prisma.room.findFirst({ where: { pgId: pg.id } });
  if (!room) throw new Error("No rooms found in PG.");

  const bedA = await prisma.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
  if (!bedA) throw new Error("No bed A found.");

  const actorId = 'system_test';
  const phone = "+919999900099";

  // Clean up
  const existing = await prisma.globalTenant.findMany({ where: { phone } });
  for (const t of existing) {
    await prisma.pGTenantProfile.updateMany({
      where: { globalTenantId: t.id },
      data: { isActive: false, bedId: null }
    });
  }

  await prisma.pGTenantProfile.updateMany({
    where: { bedId: bedA.id, status: { in: ['ACTIVE', 'NOTICE'] } },
    data: { status: 'PAST', bedId: null }
  });

  // Onboard resident Srija Dad with Expected = ₹12,000 deposit, collected = ₹12,000
  console.log("Onboarding resident Srija Dad with ₹12,000 deposit...");
  const profile = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    phone,
    "Srija Dad",
    "srijadad@refund.com",
    new Date(),
    0, // rent = 0
    12000, // deposit = 12000
    actorId,
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    true, // depositCollected = true
    'UPI',
    new Date()
  );

  // Assert expected dues before refund
  const profileBefore = await prisma.pGTenantProfile.findUnique({
    where: { id: profile.id },
    include: {
      invoices: { where: { isActive: true } },
      damageRecoveries: true
    }
  });

  if (!profileBefore) throw new Error("Profile not found.");

  const expectedDepositBefore = profileBefore.securityDeposit;
  const collectedDepositBefore = profileBefore.invoices
    .filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingRentBefore = profileBefore.invoices
    .filter(inv => inv.type === 'RENT' && inv.status !== 'PAID')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingDamageBefore = profileBefore.damageRecoveries
    .filter(rec => rec.status !== 'FULLY_RECOVERED' && rec.status !== 'WAIVED')
    .reduce((sum, rec) => sum + rec.outstandingAmount, 0);

  const depositRefundedBefore = profileBefore.depositRefundedAmount || 0;
  const remainingRefundableBefore = Math.max(0, collectedDepositBefore - depositRefundedBefore);

  console.log("\nDatabase Values BEFORE Refund:");
  console.log(`- Expected Deposit: ₹${expectedDepositBefore}`);
  console.log(`- Collected Deposit: ₹${collectedDepositBefore}`);
  console.log(`- depositRefundedAmount: ₹${depositRefundedBefore}`);
  console.log(`- remainingRefundableDeposit: ₹${remainingRefundableBefore}`);
  console.log(`- Rent Due: ₹${outstandingRentBefore}`);
  console.log(`- Damage Charges: ₹${outstandingDamageBefore}`);

  const netSettlementBefore = Math.abs((outstandingRentBefore + outstandingDamageBefore) - remainingRefundableBefore);
  console.log(`- Net Refund to Resident: ₹${netSettlementBefore}`);

  // Trigger REFUND transaction of ₹12,000
  console.log("\nTriggering REFUND settlement transaction of ₹12,000...");
  const mockReq = {
    params: { tenantId: profile.id },
    body: {
      action: 'REFUND',
      amount: 12000,
      paymentMode: 'upi'
    },
    pg: { id: pg.id },
    auth: { userId: actorId }
  } as any;

  let updatedData: any = null;
  const mockRes = {
    status: (code: number) => ({
      json: (body: any) => {
        updatedData = body.data;
      }
    })
  } as any;

  await settleMoveout(mockReq, mockRes);

  // Assert expected dues after refund
  const profileAfter = await prisma.pGTenantProfile.findUnique({
    where: { id: profile.id },
    include: {
      invoices: { where: { isActive: true } },
      damageRecoveries: true
    }
  });

  if (!profileAfter) throw new Error("Profile not found after refund.");

  const expectedDepositAfter = profileAfter.securityDeposit;
  const collectedDepositAfter = profileAfter.invoices
    .filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingRentAfter = profileAfter.invoices
    .filter(inv => inv.type === 'RENT' && inv.status !== 'PAID')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingDamageAfter = profileAfter.damageRecoveries
    .filter(rec => rec.status !== 'FULLY_RECOVERED' && rec.status !== 'WAIVED')
    .reduce((sum, rec) => sum + rec.outstandingAmount, 0);

  const depositRefundedAfter = profileAfter.depositRefundedAmount || 0;
  const remainingRefundableAfter = Math.max(0, collectedDepositAfter - depositRefundedAfter);

  console.log("\nDatabase Values AFTER Refund:");
  console.log(`- Expected Deposit: ₹${expectedDepositAfter}`);
  console.log(`- Collected Deposit: ₹${collectedDepositAfter}`);
  console.log(`- depositRefundedAmount: ₹${depositRefundedAfter}`);
  console.log(`- depositRefundedAt: ${profileAfter.depositRefundedAt}`);
  console.log(`- securityDepositStatus: ${profileAfter.securityDepositStatus}`);
  console.log(`- remainingRefundableDeposit: ₹${remainingRefundableAfter}`);
  console.log(`- Rent Due: ₹${outstandingRentAfter}`);
  console.log(`- Damage Charges: ₹${outstandingDamageAfter}`);

  const netSettlementAfter = Math.abs((outstandingRentAfter + outstandingDamageAfter) - remainingRefundableAfter);
  console.log(`- Net Settlement: ₹${netSettlementAfter}`);

  // Assert ledger transaction
  const ledgerTx = await prisma.depositLedgerTransaction.findFirst({
    where: { tenantProfileId: profile.id, type: 'DEPOSIT_REFUND' }
  });
  console.log(`\nRefund Ledger Transaction Created: ${ledgerTx ? 'YES' : 'NO'}`);
  if (ledgerTx) {
    console.log(`- Type: ${ledgerTx.type}`);
    console.log(`- Amount: ₹${ledgerTx.amount}`);
    console.log(`- Reason: ${ledgerTx.reason}`);
  }

  // Verify lock is removed
  const isUnlocked = (outstandingRentAfter + outstandingDamageAfter === 0) && (remainingRefundableAfter === 0);
  console.log(`\nSettlement Lock Status: ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}`);

  if (depositRefundedAfter !== 12000) throw new Error("Validation Fail: Refunded amount is not ₹12,000");
  if (!ledgerTx) throw new Error("Validation Fail: Refund ledger transaction was not created");
  if (!isUnlocked) throw new Error("Validation Fail: Settlement lock is not removed after refund");

  console.log("\nExecuting VacateResidentWorkflow...");
  const vacatedProfile = await VacateResidentWorkflow.execute(pg.id, profile.id, actorId);
  console.log(`Resident stay status: ${vacatedProfile.status}`);
  console.log(`Resident securityDepositStatus: ${vacatedProfile.securityDepositStatus}`);
  console.log(`Resident settlementStatus: ${vacatedProfile.settlementStatus}`);

  // Clean up
  await prisma.pGTenantProfile.updateMany({
    where: { id: profile.id },
    data: { isActive: false }
  });

  console.log("\n=== MOVEOUT SETTLEMENT REFUND UNLOCK VERIFICATION COMPLETED SUCCESSFULLY ===");
}

main().catch(console.error);
