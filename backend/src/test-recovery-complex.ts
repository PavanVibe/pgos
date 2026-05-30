import 'dotenv/config';
import prisma from './utils/prisma';
import { OnboardResidentWorkflow } from './services/workflows/OnboardResidentWorkflow';
import { ResolveComplaintWorkflow } from './services/workflows/ResolveComplaintWorkflow';
import { updateRecoveryStatus, lockStaySettlement } from './controllers/recoveriesController';
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

  // Clean existing test profiles
  const phone = "+919999966666";
  const name = "Testcase Recovery";

  console.log("Cleaning historical test profiles for phone:", phone);
  const oldTenants = await prisma.globalTenant.findMany({ where: { phone } });
  for (const tenant of oldTenants) {
    await prisma.pGTenantProfile.updateMany({
      where: { globalTenantId: tenant.id },
      data: { isActive: false }
    });
  }

  // Ensure bed is empty
  await prisma.pGTenantProfile.updateMany({
    where: { bedId: bedA.id, status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE] } },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // ----------------------------------------------------------------------
  // CASE A: OVER-DEPOSIT RECOVERY LIMITS
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE A: Over-deposit recovery limits (Deposit = ₹12,000, Recovery = ₹20,000)");
  console.log("------------------------------------------------");

  console.log("Onboarding resident with deposit of ₹12,000...");
  const profile = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    phone,
    name,
    "testcase@recovery.com",
    new Date("2026-05-30"),
    6000,
    12000,
    "system_test",
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    true, // depositCollected
    "UPI",
    new Date("2026-05-30")
  );

  // Create a complaint to attach recovery to
  console.log("Creating complaint ticket...");
  const complaint = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profile.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Room wall and fan damages needing recovery',
      status: ComplaintStatus.PENDING,
      createdBy: 'system_test',
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  console.log("Attempting to execute resolve complaint with ₹20,000 recovery via DEPOSIT method...");
  let caseAError: any = null;
  try {
    await ResolveComplaintWorkflow.execute(
      pg.id,
      complaint.id,
      'system_test',
      20000, // repairCost
      'SPECIFIC_RESIDENT',
      profile.id,
      undefined,
      undefined,
      'Resolved with over-limit recovery',
      [{ title: 'Damaged Fan', amount: 20000, notes: 'Entire fan replacement' }],
      'DEPOSIT' // method
    );
  } catch (err: any) {
    caseAError = err.message;
  }

  if (caseAError) {
    console.log(`>>> SUCCESS: Over-limit blocked successfully: "${caseAError}"`);
  } else {
    throw new Error("FAIL: System allowed a DEPOSIT recovery that exceeded the remaining refundable deposit!");
  }

  // ----------------------------------------------------------------------
  // CASE B: CASH RECOVERY COLLECTION
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE B: Cash recovery collection (₹5,000 recovery marked RECOVERED)");
  console.log("------------------------------------------------");

  // Create another complaint for Case B
  const complaintB = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profile.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Geyser repair needing direct cash recovery',
      status: ComplaintStatus.PENDING,
      createdBy: 'system_test',
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  console.log("Resolving complaint with ₹5,000 recovery via CASH method...");
  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintB.id,
    'system_test',
    5000,
    'SPECIFIC_RESIDENT',
    profile.id,
    undefined,
    undefined,
    'Geyser repaired successfully',
    [{ title: 'Geyser coil', amount: 5000, notes: 'Coil damage recovery' }],
    'CASH'
  );

  // Fetch the created recovery
  const recoveryB = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintB.id }
  });

  if (!recoveryB) {
    throw new Error("FAIL: Recovery record not created.");
  }

  console.log(`Initial recovery status: ${recoveryB.status}, Method: ${recoveryB.recoveryMethod}, Outstanding: ₹${recoveryB.amount - recoveryB.amountReceived}`);

  // Transition status to RECOVERED using updateRecoveryStatus controller
  console.log("Collecting cash payment of ₹5,000...");
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
    params: { recoveryId: recoveryB.id },
    body: { status: 'RECOVERED', amountReceived: 5000, paymentMode: 'CASH', notes: 'Collected direct cash from resident' },
    pg: { id: pg.id },
    auth: { userId: 'system_test' }
  } as any, mockRes);

  const updatedRecB = await prisma.damageRecovery.findUnique({ where: { id: recoveryB.id } });
  console.log(`Updated recovery status: ${updatedRecB?.status}, Outstanding: ₹${(updatedRecB?.amount ?? 0) - (updatedRecB?.amountReceived ?? 0)}, Received Mode: ${updatedRecB?.paymentMode}`);

  if (updatedRecB?.status !== 'RECOVERED' || updatedRecB?.amountReceived !== 5000) {
    throw new Error("FAIL: Cash collection did not transition status to RECOVERED or store received amount.");
  }
  console.log(">>> SUCCESS: Case B Passed.");

  // ----------------------------------------------------------------------
  // CASE C: WAIVED RECOVERY
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE C: Waived recovery (₹5,000 recovery transitioned to WAIVED)");
  console.log("------------------------------------------------");

  const complaintC = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profile.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'LOW',
      description: 'Minor door damage split',
      status: ComplaintStatus.PENDING,
      createdBy: 'system_test',
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintC.id,
    'system_test',
    5000,
    'SPECIFIC_RESIDENT',
    profile.id,
    undefined,
    undefined,
    'Door repaired',
    [{ title: 'Hinge repair', amount: 5000, notes: 'Door hinge split' }],
    'DEPOSIT'
  );

  const recoveryC = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintC.id }
  });

  if (!recoveryC) throw new Error("FAIL: Recovery record not created for Case C.");

  console.log("Waiving recovery C of ₹5,000...");
  await updateRecoveryStatus({
    params: { recoveryId: recoveryC.id },
    body: { status: 'WAIVED', reason: 'Waived due to good behavior' },
    pg: { id: pg.id },
    auth: { userId: 'system_test' }
  } as any, mockRes);

  const updatedRecC = await prisma.damageRecovery.findUnique({ where: { id: recoveryC.id } });
  console.log(`Updated recovery status: ${updatedRecC?.status}, Method: ${updatedRecC?.recoveryMethod}, Waived Reason: ${updatedRecC?.waivedReason}`);

  if (updatedRecC?.status !== 'WAIVED' || updatedRecC?.recoveryMethod !== 'WAIVED') {
    throw new Error("FAIL: Waiver did not transition status or change recovery method to WAIVED.");
  }

  // Ensure depositDeductionAmount is still unchanged (should be 0 since CASH recovery does not deduct from deposit, and WAIVED recovery is waived)
  const currentProfile = await prisma.pGTenantProfile.findUnique({ where: { id: profile.id } });
  console.log(`Profile deposit deduction amount: ₹${currentProfile?.depositDeductionAmount}`);
  if (currentProfile?.depositDeductionAmount !== 0) {
    throw new Error("FAIL: Deposit deduction amount should be 0.");
  }
  console.log(">>> SUCCESS: Case C Passed.");

  // ----------------------------------------------------------------------
  // CASE D: SETTLEMENT LOCK MODIFICATIONS BLOCK SAFEGUARD
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE D: Settlement Lock modifications block safeguard");
  console.log("------------------------------------------------");

  console.log("Locking resident stay settlement permanently...");
  let settlementLocked = false;
  const mockResLock = {
    status: (code: number) => {
      return {
        json: (data: any) => {
          if (code === 200) settlementLocked = true;
          else console.error("Error locking:", data.error);
        }
      };
    }
  } as any;

  await lockStaySettlement({
    params: { tenantId: profile.id },
    auth: { userId: 'system_test' }
  } as any, mockResLock);

  const lockedProfile = await prisma.pGTenantProfile.findUnique({ where: { id: profile.id } });
  console.log(`Profile settlementStatus: ${lockedProfile?.settlementStatus}`);

  if (!settlementLocked || lockedProfile?.settlementStatus !== 'LOCKED') {
    throw new Error("FAIL: Profile settlementStatus was not set to LOCKED.");
  }

  // Attempt to update status on locked stay profile should fail
  console.log("\n[Lock Safeguard Check] Attempting to update existing recovery B status...");
  let lockUpdateError: any = null;
  const mockResLockCheck = {
    status: (code: number) => {
      return {
        json: (data: any) => {
          if (code >= 400) lockUpdateError = data.error;
        }
      };
    }
  } as any;

  await updateRecoveryStatus({
    params: { recoveryId: recoveryB.id },
    body: { status: 'ACCEPTED' },
    pg: { id: pg.id },
    auth: { userId: 'system_test' }
  } as any, mockResLockCheck);

  if (lockUpdateError) {
    console.log(`>>> SUCCESS: Modification on LOCKED stay blocked: "${lockUpdateError}"`);
  } else {
    throw new Error("FAIL: Allowed modifying recovery status on LOCKED stay profile!");
  }

  // Attempt to resolve complaint on locked stay profile should fail
  console.log("\n[Lock Safeguard Check] Attempting to resolve complaint on LOCKED stay...");
  let lockCreateError: any = null;
  try {
    await ResolveComplaintWorkflow.execute(
      pg.id,
      complaint.id,
      'system_test',
      1000,
      'SPECIFIC_RESIDENT',
      profile.id,
      undefined,
      undefined,
      'Locked resolve attempt',
      [{ title: 'Locked damage', amount: 1000 }],
      'CASH'
    );
  } catch (err: any) {
    lockCreateError = err.message;
  }

  if (lockCreateError) {
    console.log(`>>> SUCCESS: Creating recovery on LOCKED stay blocked: "${lockCreateError}"`);
  } else {
    throw new Error("FAIL: Allowed creating new recoveries on LOCKED stay profile!");
  }
  console.log(">>> SUCCESS: Case D Passed.");

  // ----------------------------------------------------------------------
  // CASE E: DISPUTES LOG TRANSITIONS & AUDIT LOGS
  // ----------------------------------------------------------------------
  console.log("\n------------------------------------------------");
  console.log("TEST CASE E: Disputes log transitions");
  console.log("------------------------------------------------");

  // Unlock profile temporarily to test dispute log transition
  console.log("Temporarily unlocking profile stay to log dispute transition...");
  await prisma.pGTenantProfile.update({
    where: { id: profile.id },
    data: { settlementStatus: 'OPEN' }
  });

  const complaintE = await prisma.complaint.create({
    data: {
      pgId: pg.id,
      pgTenantId: profile.id,
      category: 'MAINTENANCE_REPAIR',
      priority: 'HIGH',
      description: 'Room wall painting recovery',
      status: ComplaintStatus.PENDING,
      createdBy: 'system_test',
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  });

  await ResolveComplaintWorkflow.execute(
    pg.id,
    complaintE.id,
    'system_test',
    4000,
    'SPECIFIC_RESIDENT',
    profile.id,
    undefined,
    undefined,
    'Wall painted',
    [{ title: 'Wall painting cost', amount: 4000 }],
    'DEPOSIT'
  );

  const recoveryE = await prisma.damageRecovery.findFirst({
    where: { complaintId: complaintE.id }
  });

  if (!recoveryE) throw new Error("FAIL: Recovery record not created for Case E.");

  console.log("Disputing recovery E...");
  await updateRecoveryStatus({
    params: { recoveryId: recoveryE.id },
    body: { status: 'DISPUTED', reason: 'Resident claims wall paint was already damaged' },
    pg: { id: pg.id },
    auth: { userId: 'system_test' }
  } as any, mockRes);

  const updatedRecE = await prisma.damageRecovery.findUnique({ where: { id: recoveryE.id } });
  console.log(`Updated recovery status: ${updatedRecE?.status}, Dispute Reason: ${updatedRecE?.disputeReason}`);

  if (updatedRecE?.status !== 'DISPUTED' || updatedRecE?.disputeReason !== 'Resident claims wall paint was already damaged') {
    throw new Error("FAIL: Dispute transition did not record correct status or reason.");
  }

  // Verify Audit Log generated
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: 'DamageRecovery', entityId: recoveryE.id }
  });

  console.log(`Found ${auditLogs.length} audit log entries for Case E.`);
  for (const log of auditLogs) {
    console.log(`- Action: ${log.action}, Metadata:`, JSON.stringify(log.metadata));
  }

  if (auditLogs.length === 0) {
    throw new Error("FAIL: No audit log generated for recovery status transition.");
  }

  console.log(">>> SUCCESS: Case E Passed.");

  console.log("\n=== ALL COMPLEX DAMAGE RECOVERY TEST CASES PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
