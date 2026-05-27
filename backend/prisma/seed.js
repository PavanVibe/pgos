"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const faker_1 = require("@faker-js/faker");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Starting DB Seed...');
    // 1. Create Organizations
    const orgNames = ['Stanza Lite', 'Zolo Standard', 'Nestaway Premium'];
    const orgs = [];
    for (const name of orgNames) {
        const org = await prisma.organization.create({
            data: {
                name,
                clerkOrgId: faker_1.faker.string.uuid(),
                subscriptionTier: client_1.SubscriptionTier.GROWTH,
            }
        });
        orgs.push(org);
    }
    console.log(`Created ${orgs.length} Organizations.`);
    // 2. Create PGs
    const pgs = [];
    for (let i = 0; i < 10; i++) {
        const org = orgs[i % orgs.length];
        const pg = await prisma.pG.create({
            data: {
                organizationId: org.id,
                name: `${faker_1.faker.location.street()} Residency PG`,
                city: faker_1.faker.location.city(),
                address: faker_1.faker.location.streetAddress(),
            }
        });
        pgs.push(pg);
    }
    console.log(`Created ${pgs.length} PGs.`);
    // 3. Create Rooms and Beds
    const beds = [];
    let roomCount = 0;
    for (const pg of pgs) {
        for (let r = 1; r <= 15; r++) {
            const room = await prisma.room.create({
                data: {
                    pgId: pg.id,
                    floor: `${Math.ceil(r / 5)}`,
                    number: `${Math.ceil(r / 5)}0${r % 5 || 5}`,
                    capacity: faker_1.faker.helpers.arrayElement([2, 3, 4])
                }
            });
            roomCount++;
            for (let b = 1; b <= room.capacity; b++) {
                const bed = await prisma.bed.create({
                    data: {
                        roomId: room.id,
                        bedNumber: `B${b}`,
                        monthlyRent: faker_1.faker.helpers.arrayElement([6000, 8000, 10000, 12000, 15000]),
                    }
                });
                beds.push({ ...bed, pgId: pg.id, roomNumber: room.number });
            }
        }
    }
    console.log(`Created ${roomCount} Rooms and ${beds.length} Beds.`);
    // 4. Create Tenants
    const activeBeds = faker_1.faker.helpers.shuffle(beds).slice(0, 350);
    let tenantCount = 0;
    let invoiceCount = 0;
    let complaintCount = 0;
    for (const bed of activeBeds) {
        const tenant = await prisma.globalTenant.create({
            data: {
                name: faker_1.faker.person.fullName(),
                phone: faker_1.faker.phone.number(),
                email: faker_1.faker.internet.email(),
                trustScore: faker_1.faker.number.int({ min: 80, max: 100 })
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
                status: client_1.TenantStatus.ACTIVE,
                securityDeposit: bed.monthlyRent * 2,
                moveInDate: faker_1.faker.date.past({ years: 1 }),
            }
        });
        tenantCount++;
        const isPending = Math.random() < 0.25;
        await prisma.rentInvoice.create({
            data: {
                pgTenantId: profile.id,
                amount: bed.monthlyRent,
                dueDate: faker_1.faker.date.soon({ days: 10 }),
                status: isPending ? client_1.InvoiceStatus.PENDING : client_1.InvoiceStatus.PAID,
                paidAt: isPending ? null : faker_1.faker.date.recent({ days: 5 }),
            }
        });
        if (isPending)
            invoiceCount++;
        if (Math.random() < 0.08) {
            await prisma.complaint.create({
                data: {
                    pgId: bed.pgId,
                    pgTenantId: profile.id,
                    category: faker_1.faker.helpers.arrayElement(['MAINTENANCE', 'FOOD', 'WIFI', 'CLEANING']),
                    description: faker_1.faker.lorem.sentence(),
                    priority: faker_1.faker.helpers.arrayElement([client_1.ComplaintPriority.LOW, client_1.ComplaintPriority.HIGH]),
                    status: client_1.ComplaintStatus.PENDING,
                    slaDeadline: faker_1.faker.date.soon({ days: 2 }),
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
//# sourceMappingURL=seed.js.map