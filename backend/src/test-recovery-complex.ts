import 'dotenv/config';
import prisma from './utils/prisma';
import { OnboardResidentWorkflow } from './services/workflows/OnboardResidentWorkflow';
import { ResolveComplaintWorkflow } from './services/workflows/ResolveComplaintWorkflow';
import { updateRecoveryStatus } from './controllers/recoveriesController';
import { TenantStatus, ComplaintStatus } from '@prisma/client';

async function main() {
  console.log("=== DAMAGE RECOVERY & SETTLEMENT PROGRAMMATIC TEST SUITE ===\n");

  // Resolve PG property context
  const pg = await prisma.pG.findFirst();
  if (!pg) throw new Error("No properties found in database.");

  const room = await prisma.room.findFirst({ where: { pgId: pg.id } });
  if (!room) throw new Error("No rooms found in property.");

  const bedA = await prisma.bed.findFirst({ where: { roomId: room.id, bedNumber: 'A' } });
  if (!bedA) throw new Error("No bed found in room.");

  const actorId = 'system_test';

  // Helper to clean up tenant by phone
  async function cleanupTenant(phone: string) {
    const tenants = await prisma.globalTenant.findMany({ where: { phone } });
    for (const tenant of tenants) {
      await prisma.pGTenantProfile.updateMany({
        where: { globalTenantId: tenant.id },
        data: { isActive: false }
      });
    }
  }

  // Ensure bed is free for testing
  await prisma.pGTenantProfile.updateMany({
    where: { bedId: bedA.id, status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE] } },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // ----------------------------------------------------------------------
  // CASE A: Recovery ₹5,000, Deposit ₹0
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE A: Recovery ₹5,000, Deposit ₹0");
  console.log("------------------------------------------------");

  const phoneA = "+919999900001";
  await cleanupTenant(phoneA);

  console.log("Onboarding resident with deposit of ₹0...");
  const profileA = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    phoneA,
    "Case A Resident",
    "casea@recovery.com",
    new Date("2026-05-30"),
    6000,
    0, // Deposit is 0
    actorId,
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    true, // depositCollected
    "UPI",
    new Date("2026-05-30")
  );

  const complaintA = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profileA.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Case A Damage (Wall damage)',
      status: ComplaintStatus.PENDING,
      createdBy: actorId,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  console.log("Resolving complaint with ₹5,000 cost via DEPOSIT recovery method...");
  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintA.id,
    actorId,
    5000,
    'SPECIFIC_RESIDENT',
    profileA.id,
    undefined,
    undefined,
    'Resolved Case A',
    [{ title: 'Wall repair', amount: 5000 }],
    'DEPOSIT'
  );

  const recoveryA = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintA.id }
  });

  if (!recoveryA) throw new Error("FAIL: Recovery A not created.");

  console.log(`Asserting Case A outcomes...`);
  console.log(`- status: ${recoveryA.status} (Expected: PENDING)`);
  console.log(`- recoveredAmount: ₹${recoveryA.recoveredAmount} (Expected: 0)`);
  console.log(`- outstandingAmount: ₹${recoveryA.outstandingAmount} (Expected: 5000)`);

  if (recoveryA.status !== 'PENDING' || recoveryA.recoveredAmount !== 0 || recoveryA.outstandingAmount !== 5000) {
    throw new Error("FAIL: Case A assertions failed!");
  }
  console.log(">>> SUCCESS: Case A Passed.");

  // Free bed for next case
  await prisma.pGTenantProfile.update({
    where: { id: profileA.id },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // ----------------------------------------------------------------------
  // CASE B: Recovery ₹5,000, Deposit ₹3,000
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE B: Recovery ₹5,000, Deposit ₹3,000");
  console.log("------------------------------------------------");

  const phoneB = "+919999900002";
  await cleanupTenant(phoneB);

  console.log("Onboarding resident with deposit of ₹3,000...");
  const profileB = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    phoneB,
    "Case B Resident",
    "caseb@recovery.com",
    new Date("2026-05-30"),
    6000,
    3000, // Deposit is 3000
    actorId,
    false,
    undefined,
    true,
    false,
    true,
    "UPI",
    new Date("2026-05-30")
  );

  const complaintB = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profileB.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Case B Damage (Broken Chair)',
      status: ComplaintStatus.PENDING,
      createdBy: actorId,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  console.log("Resolving complaint with ₹5,000 cost via DEPOSIT recovery method...");
  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintB.id,
    actorId,
    5000,
    'SPECIFIC_RESIDENT',
    profileB.id,
    undefined,
    undefined,
    'Resolved Case B',
    [{ title: 'Chair repair', amount: 5000 }],
    'DEPOSIT'
  );

  const recoveryB = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintB.id }
  });

  if (!recoveryB) throw new Error("FAIL: Recovery B not created.");

  const depositTxB = await prisma.depositLedgerTransaction.findFirst({
    where: { recoveryId: recoveryB.id }
  });

  console.log(`Asserting Case B outcomes...`);
  console.log(`- status: ${recoveryB.status} (Expected: PARTIALLY_RECOVERED)`);
  console.log(`- recoveredAmount: ₹${recoveryB.recoveredAmount} (Expected: 3000)`);
  console.log(`- outstandingAmount: ₹${recoveryB.outstandingAmount} (Expected: 2000)`);
  console.log(`- deposit transaction created: ${depositTxB ? 'YES' : 'NO'} (Expected: YES)`);
  if (depositTxB) {
    console.log(`  - tx type: ${depositTxB.type} (Expected: DEPOSIT_DEDUCTION)`);
    console.log(`  - tx amount: ₹${depositTxB.amount} (Expected: 3000)`);
  }

  if (
    recoveryB.status !== 'PARTIALLY_RECOVERED' || 
    recoveryB.recoveredAmount !== 3000 || 
    recoveryB.outstandingAmount !== 2000 ||
    !depositTxB ||
    depositTxB.type !== 'DEPOSIT_DEDUCTION' ||
    depositTxB.amount !== 3000
  ) {
    throw new Error("FAIL: Case B assertions failed!");
  }
  console.log(">>> SUCCESS: Case B Passed.");

  // Free bed
  await prisma.pGTenantProfile.update({
    where: { id: profileB.id },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // ----------------------------------------------------------------------
  // CASE C: Recovery ₹5,000, Deposit ₹12,000
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE C: Recovery ₹5,000, Deposit ₹12,000");
  console.log("------------------------------------------------");

  const phoneC = "+919999900003";
  await cleanupTenant(phoneC);

  console.log("Onboarding resident with deposit of ₹12,000...");
  const profileC = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    phoneC,
    "Case C Resident",
    "casec@recovery.com",
    new Date("2026-05-30"),
    6000,
    12000, // Deposit is 12000
    actorId,
    false,
    undefined,
    true,
    false,
    true,
    "UPI",
    new Date("2026-05-30")
  );

  const complaintC = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profileC.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Case C Damage (Broken Fan)',
      status: ComplaintStatus.PENDING,
      createdBy: actorId,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  console.log("Resolving complaint with ₹5,000 cost via DEPOSIT recovery method...");
  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintC.id,
    actorId,
    5000,
    'SPECIFIC_RESIDENT',
    profileC.id,
    undefined,
    undefined,
    'Resolved Case C',
    [{ title: 'Fan repair', amount: 5000 }],
    'DEPOSIT'
  );

  const recoveryC = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintC.id }
  });

  if (!recoveryC) throw new Error("FAIL: Recovery C not created.");

  const depositTxC = await prisma.depositLedgerTransaction.findFirst({
    where: { recoveryId: recoveryC.id }
  });

  console.log(`Asserting Case C outcomes...`);
  console.log(`- status: ${recoveryC.status} (Expected: FULLY_RECOVERED)`);
  console.log(`- recoveredAmount: ₹${recoveryC.recoveredAmount} (Expected: 5000)`);
  console.log(`- outstandingAmount: ₹${recoveryC.outstandingAmount} (Expected: 0)`);
  console.log(`- deposit transaction created: ${depositTxC ? 'YES' : 'NO'} (Expected: YES)`);
  if (depositTxC) {
    console.log(`  - tx type: ${depositTxC.type} (Expected: DEPOSIT_DEDUCTION)`);
    console.log(`  - tx amount: ₹${depositTxC.amount} (Expected: 5000)`);
  }

  if (
    recoveryC.status !== 'FULLY_RECOVERED' || 
    recoveryC.recoveredAmount !== 5000 || 
    recoveryC.outstandingAmount !== 0 ||
    !depositTxC ||
    depositTxC.type !== 'DEPOSIT_DEDUCTION' ||
    depositTxC.amount !== 5000
  ) {
    throw new Error("FAIL: Case C assertions failed!");
  }
  console.log(">>> SUCCESS: Case C Passed.");

  // Free bed
  await prisma.pGTenantProfile.update({
    where: { id: profileC.id },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // ----------------------------------------------------------------------
  // CASE D: Recovery ₹5,000, Deposit ₹3,000. Later UPI collection ₹2,000
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE D: Recovery ₹5,000, Deposit ₹3,000, Later UPI ₹2,000");
  console.log("------------------------------------------------");

  const phoneD = "+919999900004";
  await cleanupTenant(phoneD);

  console.log("Onboarding resident with deposit of ₹3,000...");
  const profileD = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    phoneD,
    "Case D Resident",
    "cased@recovery.com",
    new Date("2026-05-30"),
    6000,
    3000, // Deposit is 3000
    actorId,
    false,
    undefined,
    true,
    false,
    true,
    "UPI",
    new Date("2026-05-30")
  );

  const complaintD = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profileD.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Case D Damage (Broken Window)',
      status: ComplaintStatus.PENDING,
      createdBy: actorId,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  console.log("Resolving complaint with ₹5,000 cost via DEPOSIT recovery method...");
  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintD.id,
    actorId,
    5000,
    'SPECIFIC_RESIDENT',
    profileD.id,
    undefined,
    undefined,
    'Resolved Case D',
    [{ title: 'Window repair', amount: 5000 }],
    'DEPOSIT'
  );

  const recoveryD = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintD.id }
  });

  if (!recoveryD) throw new Error("FAIL: Recovery D not created.");

  console.log(`Initial Status: ${recoveryD.status}, Outstanding: ₹${recoveryD.outstandingAmount}`);

  // Later collect ₹2,000 via UPI using updateRecoveryStatus
  console.log("Collecting ₹2,000 outstanding via UPI...");
  let statusUpdated = false;
  const mockRes = {
    status: (code: number) => {
      return {
        json: (data: any) => {
          if (code === 200) statusUpdated = true;
          else console.error("Error from controller:", data.error);
        }
      };
    }
  } as any;

  await updateRecoveryStatus({
    params: { recoveryId: recoveryD.id },
    body: {
      status: 'FULLY_RECOVERED',
      amountReceived: 2000,
      paymentMode: 'UPI',
      referenceNumber: 'UPI-12345',
      notes: 'Later UPI payment'
    },
    pg: { id: pg.id },
    auth: { userId: actorId }
  } as any, mockRes);

  const finalRecoveryD = await prisma.damageRecovery.findUnique({
    where: { id: recoveryD.id },
    include: { recoveryTransactions: true }
  });

  if (!finalRecoveryD) throw new Error("FAIL: Final Recovery D not found.");

  console.log(`Asserting Case D outcomes...`);
  console.log(`- status: ${finalRecoveryD.status} (Expected: FULLY_RECOVERED)`);
  console.log(`- recoveredAmount: ₹${finalRecoveryD.recoveredAmount} (Expected: 5000)`);
  console.log(`- outstandingAmount: ₹${finalRecoveryD.outstandingAmount} (Expected: 0)`);
  console.log(`- number of recovery transactions: ${finalRecoveryD.recoveryTransactions.length} (Expected: 2)`);
  
  finalRecoveryD.recoveryTransactions.forEach(tx => {
    console.log(`  - transaction method: ${tx.paymentMethod}, amount: ₹${tx.amount}`);
  });

  const depositTx = finalRecoveryD.recoveryTransactions.find(t => t.paymentMethod === 'DEPOSIT');
  const upiTx = finalRecoveryD.recoveryTransactions.find(t => t.paymentMethod === 'UPI');

  if (
    finalRecoveryD.status !== 'FULLY_RECOVERED' ||
    finalRecoveryD.recoveredAmount !== 5000 ||
    finalRecoveryD.outstandingAmount !== 0 ||
    finalRecoveryD.recoveryTransactions.length !== 2 ||
    !depositTx || depositTx.amount !== 3000 ||
    !upiTx || upiTx.amount !== 2000
  ) {
    throw new Error("FAIL: Case D assertions failed!");
  }
  console.log(">>> SUCCESS: Case D Passed.");

  // Free bed
  await prisma.pGTenantProfile.update({
    where: { id: profileD.id },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // ----------------------------------------------------------------------
  // CASE E: Recovery ₹5,000, Waived
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE E: Recovery ₹5,000, Waived");
  console.log("------------------------------------------------");

  const phoneE = "+919999900005";
  await cleanupTenant(phoneE);

  console.log("Onboarding resident with deposit of ₹3,000...");
  const profileE = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    phoneE,
    "Case E Resident",
    "casee@recovery.com",
    new Date("2026-05-30"),
    6000,
    3000,
    actorId,
    false,
    undefined,
    true,
    false,
    true,
    "UPI",
    new Date("2026-05-30")
  );

  const complaintE = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profileE.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Case E Damage (Water damage)',
      status: ComplaintStatus.PENDING,
      createdBy: actorId,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  console.log("Resolving complaint with ₹5,000 cost via CASH recovery method (to start with full outstanding)...");
  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintE.id,
    actorId,
    5000,
    'SPECIFIC_RESIDENT',
    profileE.id,
    undefined,
    undefined,
    'Resolved Case E',
    [{ title: 'Water damage repair', amount: 5000 }],
    'CASH' // Start via CASH so deposit is untouched and 5000 is outstanding
  );

  const recoveryE = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintE.id }
  });

  if (!recoveryE) throw new Error("FAIL: Recovery E not created.");

  console.log("Waiving the remaining outstanding balance of ₹5,000...");
  await updateRecoveryStatus({
    params: { recoveryId: recoveryE.id },
    body: {
      status: 'WAIVED',
      reason: 'Waived due to corporate partner agreement'
    },
    pg: { id: pg.id },
    auth: { userId: actorId }
  } as any, mockRes);

  const finalRecoveryE = await prisma.damageRecovery.findUnique({
    where: { id: recoveryE.id }
  });

  if (!finalRecoveryE) throw new Error("FAIL: Final Recovery E not found.");

  const auditLogE = await prisma.auditLog.findFirst({
    where: { entityType: 'DamageRecovery', entityId: recoveryE.id, action: 'WAIVED' }
  });

  console.log(`Asserting Case E outcomes...`);
  console.log(`- status: ${finalRecoveryE.status} (Expected: WAIVED)`);
  console.log(`- outstandingAmount: ₹${finalRecoveryE.outstandingAmount} (Expected: 0)`);
  console.log(`- waived audit log generated: ${auditLogE ? 'YES' : 'NO'} (Expected: YES)`);

  if (
    finalRecoveryE.status !== 'WAIVED' ||
    finalRecoveryE.outstandingAmount !== 0 ||
    !auditLogE
  ) {
    throw new Error("FAIL: Case E assertions failed!");
  }
  console.log(">>> SUCCESS: Case E Passed.");

  console.log("\n=== ALL 5 RECOVERY VERIFICATION TEST CASES PASSED PERFECTLY ===");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
