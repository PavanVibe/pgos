import 'dotenv/config';
import { getPGDashboardSummary } from './services/dashboardService';
import prisma from './utils/prisma';

async function main() {
  const pgId = '13007fcc-2c7d-4fb1-98c6-19e07ba06363';
  const orgId = 'some-org-id'; 
  console.log("Fetching summary for PG ID:", pgId);
  try {
    const pg = await prisma.pG.findFirst();
    if (!pg) {
      console.log("No PG found in database.");
      return;
    }
    console.log(`Found PG: ${pg.name} (${pg.id}), OrgId: ${pg.organizationId}`);
    const summary = await getPGDashboardSummary(pg.id, pg.organizationId);
    console.log("Dashboard Summary Result:", JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("Error fetching summary:", error);
  }
}

main();
