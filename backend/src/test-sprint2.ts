import dotenv from 'dotenv';
dotenv.config();

import prisma from './utils/prisma';
import { addStaff, getStaffList, deactivateStaff, payStaffSalary, getStaffDetails } from './controllers/staffController';
import { getProfitSummary } from './controllers/profitController';

async function runTest() {
  console.log("=================================================");
  console.log("PGOS SPRINT 2 STAFF LEDGER & PAYMENTS TEST SUITE");
  console.log("=================================================");

  // 1. Setup PG Context
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No organization found. Seed database first.");
  
  const pg = await prisma.pG.findFirst({ where: { organizationId: org.id } });
  if (!pg) throw new Error("No PG found.");

  const now = new Date();

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
          profitSummary = res.data;
        }
      };
    }
  } as any;

  await getProfitSummary(mockReqProfit, mockResProfitBaseline);
  const baseExpenses = profitSummary.expenses;
  const baseProfit = profitSummary.profit;

  console.log(`Baseline Financial Stats:`);
  console.log(`- Expenses: ₹${baseExpenses}`);
  console.log(`- Profit: ₹${baseProfit}`);

  // 3. Register a new Helper
  console.log("\nAdding a new helper 'Ramesh Kumar' (Cook)...");
  const mockReqAddStaff = {
    pg: { id: pg.id },
    params: { pgId: pg.id },
    auth: { orgId: org.id },
    body: {
      name: 'Ramesh Kumar',
      phone: '9876543210',
      role: 'COOK',
      monthlySalary: 15000,
      joiningDate: now.toISOString()
    }
  } as any;

  let createdStaff: any = null;
  const mockResAddStaff = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          if (code !== 200) {
            console.error(`Add staff failed with status ${code}:`, res);
          }
          createdStaff = res.data;
        }
      };
    }
  } as any;

  await addStaff(mockReqAddStaff, mockResAddStaff);
  console.log(`Staff created successfully. ID: ${createdStaff.id}, Name: ${createdStaff.name}, Role: ${createdStaff.role}`);

  // 4. Verify in staff list
  console.log("\nChecking staff list...");
  const mockReqStaffList = {
    pg: { id: pg.id },
    params: { pgId: pg.id }
  } as any;

  let staffList: any[] = [];
  const mockResStaffList = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          staffList = res.data;
        }
      };
    }
  } as any;

  await getStaffList(mockReqStaffList, mockResStaffList);
  const rameshFound = staffList.find(s => s.id === createdStaff.id);
  if (!rameshFound) {
    throw new Error(`FAIL: Staff Ramesh Kumar not found in pg staff list!`);
  }
  console.log(">>> SUCCESS: Staff list correctly returns Ramesh!");

  // 5. Pay Salary to Ramesh
  console.log(`\nPaying ₹15,000 salary to Ramesh Kumar for ${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}...`);
  const mockReqPay = {
    pg: { id: pg.id },
    params: { pgId: pg.id, staffId: createdStaff.id },
    body: {
      amount: 15000,
      salaryMonth: `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`,
      notes: 'Paid via cash'
    }
  } as any;

  let salaryPayment: any = null;
  const mockResPay = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          if (code !== 200) {
            console.error(`Pay salary failed with status ${code}:`, res);
          }
          salaryPayment = res.data;
        }
      };
    }
  } as any;

  await payStaffSalary(mockReqPay, mockResPay);
  console.log(`Salary payment recorded. ID: ${salaryPayment.id}, Amount: ₹${salaryPayment.amount}`);

  // 6. Fetch details & verify salary timeline history
  console.log("\nFetching helper details & timeline...");
  const mockReqDetails = {
    pg: { id: pg.id },
    params: { pgId: pg.id, staffId: createdStaff.id }
  } as any;

  let staffDetails: any = null;
  const mockResDetails = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          staffDetails = res.data;
        }
      };
    }
  } as any;

  await getStaffDetails(mockReqDetails, mockResDetails);
  console.log(`Helper Details: ${staffDetails.name}, Role: ${staffDetails.role}`);
  console.log(`Salary Payments Count: ${staffDetails.salaryPayments.length}`);
  if (staffDetails.salaryPayments.length !== 1 || staffDetails.salaryPayments[0].amount !== 15000) {
    throw new Error(`FAIL: Salary history does not match expected payment!`);
  }
  console.log(">>> SUCCESS: Salary payments timeline returned correctly!");

  // 7. Fetch updated profit summary & verify expense change
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
  console.log(`\nUpdated Financial Stats after salary payment:`);
  console.log(`- Expenses: ₹${profitSummary.expenses} (Expected increase: ₹15,000)`);
  console.log(`- Profit: ₹${profitSummary.profit} (Expected decrease: ₹15,000)`);

  if (profitSummary.expenses !== baseExpenses + 15000) {
    throw new Error(`FAIL: Expenses did not increase by ₹15,000. Got: ₹${profitSummary.expenses}, expected: ₹${baseExpenses + 15000}`);
  }
  if (profitSummary.profit !== baseProfit - 15000) {
    throw new Error(`FAIL: Profit did not decrease by ₹15,000. Got: ₹${profitSummary.profit}, expected: ₹${baseProfit - 15000}`);
  }
  console.log(">>> SUCCESS: Operational expenses updated seamlessly!");

  // 8. Test deactivation of Ramesh
  console.log("\nDeactivating Ramesh Kumar...");
  const mockReqDeactivate = {
    pg: { id: pg.id },
    params: { pgId: pg.id, staffId: createdStaff.id }
  } as any;

  let deactivatedStaff: any = null;
  const mockResDeactivate = {
    status: (code: number) => {
      return {
        json: (res: any) => {
          deactivatedStaff = res.data;
        }
      };
    }
  } as any;

  await deactivateStaff(mockReqDeactivate, mockResDeactivate);
  if (deactivatedStaff.status !== 'INACTIVE') {
    throw new Error(`FAIL: Helper is not marked INACTIVE!`);
  }
  console.log(">>> SUCCESS: Helper marked INACTIVE successfully!");

  // 9. Cleanup
  console.log("\nCleaning up database records...");
  await prisma.staffSalaryPayment.deleteMany({ where: { staffId: createdStaff.id } });
  await prisma.staff.delete({ where: { id: createdStaff.id } });
  console.log("Test cleanup completed successfully.");
}

runTest()
  .then(() => {
    console.log("\n=================================================");
    console.log("ALL SPRINT 2 STAFF & SALARY TESTS PASSED PERFECTLY!");
    console.log("=================================================");
    process.exit(0);
  })
  .catch((err) => {
    console.error("TEST ERROR:", err);
    process.exit(1);
  });
