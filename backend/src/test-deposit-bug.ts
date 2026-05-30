import 'dotenv/config';
import prisma from './utils/prisma';
import { OnboardResidentWorkflow } from './services/workflows/OnboardResidentWorkflow';
import { VacateResidentWorkflow } from './services/workflows/VacateResidentWorkflow';
import { BedLockService } from './services/locks/BedLockService';
import { TenantStatus, InvoiceStatus } from '@prisma/client';

async function main() {
  console.log("=== SECURITY DEPOSIT ACCOUNTING VERIFICATION SUITE ===\n");

  // 1. Resolve PG, Room, Bed
  let pg = await prisma.pG.findFirst();
  if (!pg) {
    console.log("Creating dummy PG for test...");
    const org = await prisma.organization.upsert({
      where: { clerkOrgId: 'org_test_clerk' },
      update: {},
      create: { name: 'Test Org', clerkOrgId: 'org_test_clerk' }
    });
    pg = await prisma.pG.create({
      data: { name: 'Test Sunrise PG', city: 'Bangalore', organizationId: org.id }
    });
  }
  console.log(`Using PG: ${pg.name} (${pg.id})`);

  let room = await prisma.room.findFirst({ where: { pgId: pg.id } });
  if (!room) {
    room = await prisma.room.create({
      data: { pgId: pg.id, number: '101', capacity: 2 }
    });
  }

  let bedA = await prisma.bed.findFirst({ where: { roomId: room.id, isActive: true } });
  if (!bedA) {
    bedA = await prisma.bed.create({
      data: { roomId: room.id, bedNumber: 'A', monthlyRent: 6000 }
    });
  }

  // Ensure bed A is unoccupied
  await prisma.pGTenantProfile.updateMany({
    where: { bedId: bedA.id, status: { in: [TenantStatus.ACTIVE, TenantStatus.INCOMPLETE, TenantStatus.NOTICE] } },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  // =========================================================================
  // TEST CASE A: Deposit Collected (UPI, 29 May 2026)
  // =========================================================================
  console.log("\n------------------------------------------------");
  console.log("TEST CASE A: Deposit Collected (Rent = ₹6,000, Deposit = ₹12,000)");
  console.log("------------------------------------------------");

  const collectDate = new Date("2026-05-29T12:00:00Z");
  const profileA = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    "+919876543210",
    "John Doe (Test A)",
    "john.doe@test.com",
    new Date(),
    6000,
    12000,
    "actor_test_123",
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    true, // depositCollected
    "UPI", // depositPaymentMode
    collectDate // depositCollectedAt
  );

  // Fetch full details with invoices
  const residentA = await prisma.pGTenantProfile.findUnique({
    where: { id: profileA.id },
    include: { invoices: true }
  });

  if (!residentA) throw new Error("Resident A not found after onboarding");

  // Calculations
  const totalRentPaidA = residentA.invoices
    .filter((inv) => inv.type === 'RENT' && inv.status === InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingRentA = residentA.invoices
    .filter((inv) => inv.type === 'RENT' && inv.status !== InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const securityDepositHeldA = residentA.invoices
    .filter((inv) => inv.type === 'SECURITY_DEPOSIT' && inv.status === InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingTotalA = residentA.invoices
    .filter((inv) => inv.status !== InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  console.log(`- securityDepositStatus: ${residentA.securityDepositStatus}`);
  console.log(`- depositCollectedAt: ${residentA.depositCollectedAt?.toISOString()}`);
  console.log(`- Outstanding Rent: ₹${outstandingRentA}`);
  console.log(`- Deposit Held: ₹${securityDepositHeldA}`);
  console.log(`- Total Outstanding Dues: ₹${outstandingTotalA}`);

  // Assertions Case A
  const passedA = 
    residentA.securityDepositStatus === 'COLLECTED' &&
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
  await BedLockService.acquireLock(bedA.id, "actor_test_123");
  await prisma.pGTenantProfile.update({
    where: { id: residentA.id },
    data: { status: TenantStatus.PAST, bedId: null }
  });

  const profileB = await OnboardResidentWorkflow.execute(
    pg.id,
    bedA.id,
    "+919876543211",
    "Jane Smith (Test B)",
    "jane.smith@test.com",
    new Date(),
    6000,
    12000,
    "actor_test_123",
    false,
    undefined,
    true, // bypassEmailCheck
    false,
    false, // depositCollected = false
    undefined,
    undefined
  );

  const residentB = await prisma.pGTenantProfile.findUnique({
    where: { id: profileB.id },
    include: { invoices: true }
  });

  if (!residentB) throw new Error("Resident B not found after onboarding");

  const outstandingRentB = residentB.invoices
    .filter((inv) => inv.type === 'RENT' && inv.status !== InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const securityDepositHeldB = residentB.invoices
    .filter((inv) => inv.type === 'SECURITY_DEPOSIT' && inv.status === InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingTotalB = residentB.invoices
    .filter((inv) => inv.status !== InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  console.log(`- securityDepositStatus: ${residentB.securityDepositStatus}`);
  console.log(`- depositCollectedAt: ${residentB.depositCollectedAt || 'null'}`);
  console.log(`- Outstanding Rent: ₹${outstandingRentB}`);
  console.log(`- Deposit Held: ₹${securityDepositHeldB}`);
  console.log(`- Total Outstanding Dues: ₹${outstandingTotalB}`);

  // Assertions Case B
  const passedB = 
    residentB.securityDepositStatus === 'PENDING' &&
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
  await VacateResidentWorkflow.execute(pg.id, residentB.id, "actor_test_123");

  const historicalResidentB = await prisma.pGTenantProfile.findUnique({
    where: { id: residentB.id },
    include: { invoices: true }
  });

  if (!historicalResidentB) throw new Error("Historical Resident B not found after vacating");

  console.log(`- Historical Status: ${historicalResidentB.status}`);
  console.log(`- Saved Rent Amount: ₹${historicalResidentB.monthlyRent}`);
  console.log(`- Saved Deposit Amount: ₹${historicalResidentB.securityDeposit}`);
  console.log(`- Saved Deposit Status: ${historicalResidentB.securityDepositStatus}`);
  console.log(`- Invoices preserved count: ${historicalResidentB.invoices.length}`);

  const passedC =
    historicalResidentB.status === TenantStatus.PAST &&
    historicalResidentB.monthlyRent === 6000 &&
    historicalResidentB.securityDeposit === 12000 &&
    historicalResidentB.securityDepositStatus === 'PENDING' &&
    historicalResidentB.invoices.length === 2;

  console.log(`\nResult Case C: ${passedC ? "PASSED" : "FAILED"}`);

  console.log("\n=== ALL TEST CASES COMPLETED SUCCESFULLY ===");
  if (passedA && passedB && passedC) {
    console.log(">>> VERIFICATION SUITE: ALL TESTS PASSED MATCHING THE SPECIFICATIONS <<<\n");
  } else {
    console.log(">>> VERIFICATION SUITE: SOME TESTS FAILED <<<\n");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
