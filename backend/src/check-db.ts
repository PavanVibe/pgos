import 'dotenv/config';
import prisma from './utils/prisma';

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log('Total Organizations:', orgs.length);
  orgs.forEach(org => {
    console.log(`Org ID: ${org.id}, Name: ${org.name}, ClerkOrgID: ${org.clerkOrgId}, IsActive: ${org.isActive}`);
  });

  const pgs = await prisma.pG.findMany();
  console.log('Total PGs:', pgs.length);
  pgs.forEach(pg => {
    console.log(`PG ID: ${pg.id}, Name: ${pg.name}, OrgID: ${pg.organizationId}, IsActive: ${pg.isActive}`);
  });

  const rooms = await prisma.room.findMany();
  console.log('Total Rooms:', rooms.length);

  const beds = await prisma.bed.findMany();
  console.log('Total Beds:', beds.length);

  const activeProfiles = await prisma.pGTenantProfile.findMany({
    where: { isActive: true }
  });
  console.log('Total Active Tenant Profiles:', activeProfiles.length);

  const profitSummaries = await prisma.monthlyBusinessSnapshot.findMany();
  console.log('Total Monthly snapshots:', profitSummaries.length);
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
