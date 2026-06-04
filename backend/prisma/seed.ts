import "dotenv/config";
import { PrismaClient, SubscriptionTier, TenantStatus, InvoiceStatus, ComplaintPriority, ComplaintStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting DB Seed...');

  // Clear existing data in correct dependency order
  await prisma.damageRecoveryItem.deleteMany();
  await prisma.recoveryTransaction.deleteMany();
  await prisma.paymentLink.deleteMany();
  await prisma.paymentReceipt.deleteMany();
  await prisma.damageRecovery.deleteMany();
  await prisma.depositLedgerTransaction.deleteMany();
  await prisma.staffSalaryPayment.deleteMany();
  if (prisma.cleaningChecklist) await prisma.cleaningChecklist.deleteMany();
  await prisma.monthlyBusinessSnapshot.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.eventLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.rentInvoice.deleteMany();
  await prisma.pGTenantProfile.deleteMany();
  await prisma.globalTenant.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.room.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.pG.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.organization.deleteMany();

  console.log('Cleared existing data.');

  // 1. Create Organizations — first one uses your real Clerk org ID
  const orgData = [
    { name: 'Stamm Grove Residency', clerkOrgId: 'org_3ELZDyVuL352phd5rNkhpBM3QdX' },
    { name: 'Zolo Standard', clerkOrgId: faker.string.uuid() },
    { name: 'Nestaway Premium', clerkOrgId: faker.string.uuid() },
  ];

  const orgs = [];
  for (const data of orgData) {
    const org = await prisma.organization.create({
      data: {
        name: data.name,
        clerkOrgId: data.clerkOrgId,
        subscriptionTier: SubscriptionTier.GROWTH,
      }
    });
    orgs.push(org);
  }

  console.log(`Created ${orgs.length} Organizations.`);

  // 2. Create Staff (link your real user to the first org)
  await prisma.staff.create({
    data: {
      organizationId: orgs[0]!.id,
      clerkUserId: 'user_3DwfiAMqxJVwH48O2D1ODuDLsBV',
      name: 'Pavan',
      phone: '9999999999',
      role: 'MANAGER',
    }
  });

  console.log('Created Staff member.');

  // 3. Create PGs
  const pgs = [];
  for (let i = 0; i < 10; i++) {
    const org = orgs[i % orgs.length]!;
    const pg = await prisma.pG.create({
      data: {
        organizationId: org.id,
        name: `${faker.location.street()} Residency PG`,
        city: faker.location.city(),
        address: faker.location.streetAddress(),
      }
    });
    pgs.push(pg);
  }

  console.log(`Created ${pgs.length} PGs.`);

  // 4. Create Rooms and Beds
  const beds = [];
  let roomCount = 0;
  for (const pg of pgs) {
    for (let r = 1; r <= 15; r++) {
      const room = await prisma.room.create({
        data: {
          pgId: pg.id,
          floor: `${Math.ceil(r / 5)}`,
          number: `${Math.ceil(r / 5)}0${r % 5 || 5}`,
          capacity: faker.helpers.arrayElement([2, 3, 4])
        }
      });
      roomCount++;

      for (let b = 1; b <= room.capacity; b++) {
        const bed = await prisma.bed.create({
          data: {
            roomId: room.id,
            bedNumber: `B${b}`,
            monthlyRent: faker.helpers.arrayElement([6000, 8000, 10000, 12000, 15000]),
          }
        });
        beds.push({ ...bed, pgId: pg.id, roomNumber: room.number });
      }
    }
  }

  console.log(`Created ${roomCount} Rooms and ${beds.length} Beds.`);

  // 5. Create Tenants
  const activeBeds = faker.helpers.shuffle(beds).slice(0, 350);

  let tenantCount = 0;
  let invoiceCount = 0;
  let complaintCount = 0;

  for (const bed of activeBeds) {
    const tenant = await prisma.globalTenant.create({
      data: {
        name: faker.person.fullName(),
        phone: faker.phone.number(),
        email: faker.internet.email(),
        trustScore: faker.number.int({ min: 80, max: 100 })
      }
    });

    const profile = await prisma.pGTenantProfile.create({
      data: {
        globalTenantId: tenant.id,
        pgId: bed.pgId,
        bedId: bed.id,
        roomId: bed.roomId,
        historicalRoomNumber: bed.roomNumber,
        historicalBedNumber: bed.bedNumber,
        status: TenantStatus.ACTIVE,
        securityDeposit: bed.monthlyRent * 2,
        moveInDate: faker.date.past({ years: 1 }),
      }
    });
    tenantCount++;

    const isPending = Math.random() < 0.25;
    await prisma.rentInvoice.create({
      data: {
        pgTenantId: profile.id,
        amount: bed.monthlyRent,
        dueDate: faker.date.soon({ days: 10 }),
        status: isPending ? InvoiceStatus.PENDING : InvoiceStatus.PAID,
        paidAt: isPending ? null : faker.date.recent({ days: 5 }),
      }
    });
    if (isPending) invoiceCount++;

    if (Math.random() < 0.08) {
      await prisma.complaint.create({
        data: {
          pgId: bed.pgId,
          pgTenantId: profile.id,
          category: faker.helpers.arrayElement(['MAINTENANCE', 'FOOD', 'WIFI', 'CLEANING']),
          description: faker.lorem.sentence(),
          priority: faker.helpers.arrayElement([ComplaintPriority.LOW, ComplaintPriority.HIGH]),
          status: ComplaintStatus.PENDING,
          slaDeadline: faker.date.soon({ days: 2 }),
        }
      });
      complaintCount++;
    }
  }

  console.log(`Created ${tenantCount} Active Tenants.`);
  console.log(`Created ${invoiceCount} Pending Invoices.`);
  console.log(`Created ${complaintCount} Complaints.`);
  console.log('DB Seeding Completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });