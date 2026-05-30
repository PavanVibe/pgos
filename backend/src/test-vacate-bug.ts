import prisma from './utils/prisma';
import { OnboardResidentWorkflow } from './services/workflows/OnboardResidentWorkflow';
import { VacateResidentWorkflow } from './services/workflows/VacateResidentWorkflow';
import { TenantStatus, InvoiceStatus } from '@prisma/client';

async function runTests() {
  console.log("=================================================");
  console.log("VACATE SETTLEMENT CALCULATIONS & LEDGER TEST SUITE");
  console.log("=================================================");

  // 0. Setup common PG and Room
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No organization found. Seed database first.");
  
  const pg = await prisma.pG.findFirst({ where: { organizationId: org.id } });
  if (!pg) throw new Error("No PG found.");

  const bed = await prisma.bed.findFirst({ where: { isActive: true } });
  if (!bed) throw new Error("No bed found.");

  // Clean up any active profile on this bed
  await prisma.pGTenantProfile.updateMany({
    where: { bedId: bed.id, status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE, TenantStatus.INCOMPLETE] } },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // -----------------------------------------------------------------
  // CASE 1: Collected Deposit = ₹12,000, Damage Recovery = ₹20,000
  // Expected: Refund = ₹0, Remaining Liability = ₹8,000
  // -----------------------------------------------------------------
  console.log("\n-------------------------------------------------");
  console.log("TEST CASE 1: Collected Deposit ₹12,000, Damage Recovery ₹20,000");
  console.log("-------------------------------------------------");

  const phone1 = "+919999911111";
  // Clean up any old test profiles
  const oldTenants1 = await prisma.globalTenant.findMany({ where: { phone: phone1 } });
  for (const t of oldTenants1) {
    await prisma.pGTenantProfile.updateMany({ where: { globalTenantId: t.id }, data: { isActive: false, status: TenantStatus.PAST } });
  }

  console.log("Onboarding resident with Expected = ₹12,000, Collected = ₹12,000...");
  const profile1 = await OnboardResidentWorkflow.execute(
    pg.id,
    bed.id,
    phone1,
    "Resident One (Case 1)",
    "res1@case1.com",
    new Date(),
    0, // rent = 0 to isolate deposit calculations
    12000,
    "system_test",
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    true, // depositCollected
    "UPI",
    new Date()
  );

  console.log("Creating Damage Recovery of ₹20,000 for Resident One...");
  const recovery1 = await prisma.damageRecovery.create({
    data: {
      pgId: pg.id,
      tenantId: profile1.id,
      roomId: profile1.roomId,
      amount: 20000,
      totalAmount: 20000,
      outstandingAmount: 20000,
      recoveredAmount: 0,
      reason: "Broken LED TV",
      status: "PENDING",
      recoveryMethod: "DEPOSIT"
    }
  });

  console.log("Executing Vacate Resident Workflow...");
  const vacated1 = await VacateResidentWorkflow.execute(pg.id, profile1.id, "system_test");

  // Reload profile and damage recovery to assert fields
  const updatedProfile1 = await prisma.pGTenantProfile.findUnique({
    where: { id: profile1.id },
    include: { damageRecoveries: true }
  });

  const updatedRecovery1 = await prisma.damageRecovery.findUnique({
    where: { id: recovery1.id }
  });

  console.log(`- status: ${updatedProfile1?.status} (Expected: PAST)`);
  console.log(`- depositRefundedAmount: ₹${updatedProfile1?.depositRefundedAmount} (Expected: ₹0)`);
  console.log(`- depositDeductionAmount: ₹${updatedProfile1?.depositDeductionAmount} (Expected: ₹12,000)`);
  console.log(`- securityDepositStatus: ${updatedProfile1?.securityDepositStatus} (Expected: REFUNDED)`);
  console.log(`- settlementStatus: ${updatedProfile1?.settlementStatus} (Expected: SETTLED)`);
  console.log(`- Damage Recovery status: ${updatedRecovery1?.status} (Expected: PARTIALLY_RECOVERED)`);
  console.log(`- Damage Recovery outstandingAmount: ₹${updatedRecovery1?.outstandingAmount} (Expected: ₹8,000)`);

  if (updatedProfile1?.status !== TenantStatus.PAST) throw new Error("Case 1 Fail: Status not PAST");
  if (updatedProfile1?.depositRefundedAmount !== 0) throw new Error("Case 1 Fail: depositRefundedAmount is not ₹0");
  if (updatedProfile1?.depositDeductionAmount !== 12000) throw new Error("Case 1 Fail: depositDeductionAmount is not ₹12,000");
  if (updatedRecovery1?.status !== "PARTIALLY_RECOVERED") throw new Error("Case 1 Fail: Recovery status not PARTIALLY_RECOVERED");
  if (updatedRecovery1?.outstandingAmount !== 8000) throw new Error("Case 1 Fail: Recovery outstanding amount is not ₹8,000");

  console.log(">>> SUCCESS: Case 1 Passed.");

  // -----------------------------------------------------------------
  // CASE 2: Expected Deposit = ₹12,000, Collected Deposit = ₹0
  // Expected: Refund = ₹0, No deposit available.
  // -----------------------------------------------------------------
  console.log("\n-------------------------------------------------");
  console.log("TEST CASE 2: Expected Deposit ₹12,000, Collected Deposit ₹0");
  console.log("-------------------------------------------------");

  const phone2 = "+919999922222";
  const oldTenants2 = await prisma.globalTenant.findMany({ where: { phone: phone2 } });
  for (const t of oldTenants2) {
    await prisma.pGTenantProfile.updateMany({ where: { globalTenantId: t.id }, data: { isActive: false, status: TenantStatus.PAST } });
  }

  console.log("Onboarding resident with Expected = ₹12,000, Collected = ₹0...");
  const profile2 = await OnboardResidentWorkflow.execute(
    pg.id,
    bed.id,
    phone2,
    "Resident Two (Case 2)",
    "res2@case2.com",
    new Date(),
    0, // rent = 0 to isolate deposit calculations
    12000,
    "system_test",
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    false, // depositCollected = false
    undefined,
    undefined
  );

  console.log("Executing Vacate Resident Workflow...");
  const vacated2 = await VacateResidentWorkflow.execute(pg.id, profile2.id, "system_test");

  const updatedProfile2 = await prisma.pGTenantProfile.findUnique({
    where: { id: profile2.id }
  });

  console.log(`- status: ${updatedProfile2?.status} (Expected: PAST)`);
  console.log(`- depositRefundedAmount: ₹${updatedProfile2?.depositRefundedAmount} (Expected: ₹0)`);
  console.log(`- depositDeductionAmount: ₹${updatedProfile2?.depositDeductionAmount} (Expected: ₹0)`);
  console.log(`- securityDepositStatus: ${updatedProfile2?.securityDepositStatus} (Expected: REFUNDED)`);

  if (updatedProfile2?.status !== TenantStatus.PAST) throw new Error("Case 2 Fail: Status not PAST");
  if (updatedProfile2?.depositRefundedAmount !== 0) throw new Error("Case 2 Fail: depositRefundedAmount is not ₹0");
  if (updatedProfile2?.depositDeductionAmount !== 0) throw new Error("Case 2 Fail: depositDeductionAmount is not ₹0");

  console.log(">>> SUCCESS: Case 2 Passed.");

  // -----------------------------------------------------------------
  // CASE 3: Collected Deposit = ₹12,000, Damage Recovery = ₹5,000
  // Expected: Refund = ₹7,000
  // -----------------------------------------------------------------
  console.log("\n-------------------------------------------------");
  console.log("TEST CASE 3: Collected Deposit ₹12,000, Damage Recovery ₹5,000");
  console.log("-------------------------------------------------");

  const phone3 = "+919999933333";
  const oldTenants3 = await prisma.globalTenant.findMany({ where: { phone: phone3 } });
  for (const t of oldTenants3) {
    await prisma.pGTenantProfile.updateMany({ where: { globalTenantId: t.id }, data: { isActive: false, status: TenantStatus.PAST } });
  }

  console.log("Onboarding resident with Expected = ₹12,000, Collected = ₹12,000...");
  const profile3 = await OnboardResidentWorkflow.execute(
    pg.id,
    bed.id,
    phone3,
    "Resident Three (Case 3)",
    "res3@case3.com",
    new Date(),
    0, // rent = 0 to isolate deposit calculations
    12000,
    "system_test",
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    true, // depositCollected
    "CASH",
    new Date()
  );

  console.log("Creating Damage Recovery of ₹5,000 for Resident Three...");
  const recovery3 = await prisma.damageRecovery.create({
    data: {
      pgId: pg.id,
      tenantId: profile3.id,
      roomId: profile3.roomId,
      amount: 5000,
      totalAmount: 5000,
      outstandingAmount: 5000,
      recoveredAmount: 0,
      reason: "Broken Fan",
      status: "PENDING",
      recoveryMethod: "DEPOSIT"
    }
  });

  console.log("Executing Vacate Resident Workflow...");
  const vacated3 = await VacateResidentWorkflow.execute(pg.id, profile3.id, "system_test");

  const updatedProfile3 = await prisma.pGTenantProfile.findUnique({
    where: { id: profile3.id }
  });

  const updatedRecovery3 = await prisma.damageRecovery.findUnique({
    where: { id: recovery3.id }
  });

  console.log(`- status: ${updatedProfile3?.status} (Expected: PAST)`);
  console.log(`- depositRefundedAmount: ₹${updatedProfile3?.depositRefundedAmount} (Expected: ₹7,000)`);
  console.log(`- depositDeductionAmount: ₹${updatedProfile3?.depositDeductionAmount} (Expected: ₹5,000)`);
  console.log(`- securityDepositStatus: ${updatedProfile3?.securityDepositStatus} (Expected: REFUNDED)`);
  console.log(`- Damage Recovery status: ${updatedRecovery3?.status} (Expected: FULLY_RECOVERED)`);
  console.log(`- Damage Recovery outstandingAmount: ₹${updatedRecovery3?.outstandingAmount} (Expected: ₹0)`);

  if (updatedProfile3?.status !== TenantStatus.PAST) throw new Error("Case 3 Fail: Status not PAST");
  if (updatedProfile3?.depositRefundedAmount !== 7000) throw new Error("Case 3 Fail: depositRefundedAmount is not ₹7,000");
  if (updatedProfile3?.depositDeductionAmount !== 5000) throw new Error("Case 3 Fail: depositDeductionAmount is not ₹5,000");
  if (updatedRecovery3?.status !== "FULLY_RECOVERED") throw new Error("Case 3 Fail: Recovery status not FULLY_RECOVERED");
  if (updatedRecovery3?.outstandingAmount !== 0) throw new Error("Case 3 Fail: Recovery outstanding amount is not ₹0");

  console.log(">>> SUCCESS: Case 3 Passed.");
}

runTests()
  .then(() => {
    console.log("\n=================================================");
    console.log("ALL VACATE SETTLEMENT AND LEDGER TESTS PASSED!");
    console.log("=================================================");
    process.exit(0);
  })
  .catch((err) => {
    console.error("TEST SUITE ERROR:", err);
    process.exit(1);
  });
