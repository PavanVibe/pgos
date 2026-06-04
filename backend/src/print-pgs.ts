import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const connectionString = 'postgresql://postgres:dkzEdxFEDTOcuxTvduEcsCFYjNszgsCE@zephyr.proxy.rlwy.net:14521/railway';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Fetching PGs...');
  try {
    const pgs = await prisma.pG.findMany();
    console.log('Total PGs:', pgs.length);
    pgs.forEach(pg => {
      console.log(`PG ID: ${pg.id}, Name: ${pg.name}, City: ${pg.city}`);
    });
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
