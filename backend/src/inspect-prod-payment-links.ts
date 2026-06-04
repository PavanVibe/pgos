import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const connectionString = 'postgresql://postgres:dkzEdxFEDTOcuxTvduEcsCFYjNszgsCE@zephyr.proxy.rlwy.net:14521/railway';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Connecting to prod DB...');
  try {
    const paymentLinks = await prisma.paymentLink.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Total Payment Links:', paymentLinks.length);
    paymentLinks.forEach(link => {
      console.log(`Link ID: ${link.id}, URL: ${link.paymentUrl}, CreatedAt: ${link.createdAt}`);
    });

    const receipts = await prisma.paymentReceipt.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Total Receipts:', receipts.length);
    receipts.forEach(receipt => {
      console.log(`Receipt ID: ${receipt.id}, TransactionId: ${receipt.transactionId}`);
    });

    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Total Audit Logs:', logs.length);
    logs.forEach(log => {
      console.log(`Log Action: ${log.action}, Metadata: ${JSON.stringify(log.metadata)}`);
    });
  } catch (err: any) {
    console.error('Error querying database:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
