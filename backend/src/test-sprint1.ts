import prisma from './utils/prisma';
import { addExpense, getExpensesTimeline } from './controllers/expensesController';
import { getProfitSummary } from './controllers/profitController';
import { getVacancyImpact } from './controllers/operationsController';

async function runTest() {
  console.log("=================================================");
  console.log("PGOS SPRINT 1 BUSINESS LOGIC & LEDGER TEST SUITE");
  console.log("=================================================");

  // 1. Setup PG context
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No organization found. Seed database first.");
  
  const pg = await prisma.pG.findFirst({ where: { organizationId: org.id } });
  if (!pg) throw new Error("No PG found.");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 2. Fetch baseline profit summary
  const mockReqProfit = {
    pg: { id: pg.id },
    params: { pgId: pg.id },
    query: { month: (now.getMonth() + 1).toString(), year: now.getFullYear().toString() }
  } as any;

  let profitSummary: any = null;
  const mockResProfitBaseline = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          if (code !== 200) {
            console.error(`Baseline profit summary query failed with status ${code}:`, res);
          }
          profitSummary = res.data;
        }
      };
    }
  } as any;

  await getProfitSummary(mockReqProfit, mockResProfitBaseline);
  const baseExpenses = profitSummary.expenses;
  const baseRevenue = profitSummary.revenue;
  const baseProfit = profitSummary.profit;

  console.log(`Baseline Financial Stats:`);
  console.log(`- Revenue: ₹${baseRevenue}`);
  console.log(`- Expenses: ₹${baseExpenses}`);
  console.log(`- Profit: ₹${baseProfit}`);

  // 3. Add a test expense
  console.log("\nAdding a test ELECTRICITY expense of ₹4,500...");
  const mockReqAddExpense = {
    pg: { id: pg.id },
    params: { pgId: pg.id },
    auth: { userId: 'system_test' },
    body: {
      title: 'Electricity Bill May 2026',
      amount: 4500,
      category: 'ELECTRICITY',
      incurredAt: now.toISOString(),
      notes: 'Test note for May bill'
    }
  } as any;

  let createdExpense: any = null;
  const mockResAddExpense = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          createdExpense = res.data;
        }
      };
    }
  } as any;

  await addExpense(mockReqAddExpense, mockResAddExpense);
  console.log(`Expense created successfully. ID: ${createdExpense.id}, Title: ${createdExpense.title}`);

  // 4. Fetch updated profit summary
  const mockResProfitUpdated = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          profitSummary = res.data;
        }
      };
    }
  } as any;

  await getProfitSummary(mockReqProfit, mockResProfitUpdated);
  console.log(`\nUpdated Financial Stats after test expense:`);
  console.log(`- Revenue: ₹${profitSummary.revenue}`);
  console.log(`- Expenses: ₹${profitSummary.expenses} (Expected increase: ₹4,500)`);
  console.log(`- Profit: ₹${profitSummary.profit} (Expected decrease: ₹4,500)`);

  if (profitSummary.expenses !== baseExpenses + 4500) {
    throw new Error(`FAIL: Expenses did not increase by ₹4,500. Got: ₹${profitSummary.expenses}, expected: ₹${baseExpenses + 4500}`);
  }
  if (profitSummary.profit !== baseProfit - 4500) {
    throw new Error(`FAIL: Profit did not decrease by ₹4,500. Got: ₹${profitSummary.profit}, expected: ₹${baseProfit - 4500}`);
  }
  console.log(">>> SUCCESS: Profit and Expense totals match exactly!");

  // 5. Verify Vacancy Impact Card Calculations
  console.log("\nVerifying Vacancy Impact Calculations...");
  const mockReqVacancy = {
    pg: { id: pg.id },
    params: { pgId: pg.id }
  } as any;

  let vacancyStats: any = null;
  const mockResVacancy = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          vacancyStats = res.data;
        }
      };
    }
  } as any;

  await getVacancyImpact(mockReqVacancy, mockResVacancy);
  console.log(`Occupancy Summary:`);
  console.log(`- Total Beds: ${vacancyStats.totalBeds}`);
  console.log(`- Occupied Beds: ${vacancyStats.occupiedBeds}`);
  console.log(`- Vacant Beds: ${vacancyStats.vacantBeds}`);
  console.log(`- Potential Revenue Opportunity: ₹${vacancyStats.potentialRevenueLost}`);

  // Verify formula: Vacant beds count should match the math
  if (vacancyStats.occupiedBeds + vacancyStats.vacantBeds !== vacancyStats.totalBeds) {
    throw new Error("FAIL: Occupied + Vacant Beds does not equal Total Beds count!");
  }
  console.log(">>> SUCCESS: Vacancy Impact numbers are mathematically consistent!");

  // Clean up test expense
  await prisma.expense.delete({ where: { id: createdExpense.id } });
  console.log("\nCleaned up test expense record.");
}

runTest()
  .then(() => {
    console.log("\n=================================================");
    console.log("ALL SPRINT 1 BUSINESS LOGIC TESTS PASSED PERFECTLY!");
    console.log("=================================================");
    process.exit(0);
  })
  .catch((err) => {
    console.error("TEST ERROR:", err);
    process.exit(1);
  });
