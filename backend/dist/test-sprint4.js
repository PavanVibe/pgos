"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = __importDefault(require("./utils/prisma"));
const operationsController_1 = require("./controllers/operationsController");
async function runTest() {
    console.log("=================================================");
    console.log("PGOS SPRINT 4 DAILY CHECKLIST & SUMMARY TEST SUITE");
    console.log("=================================================");
    // 1. Setup PG Context
    const org = await prisma_1.default.organization.findFirst();
    if (!org)
        throw new Error("No organization found. Seed database first.");
    const pg = await prisma_1.default.pG.findFirst({ where: { organizationId: org.id } });
    if (!pg)
        throw new Error("No PG found.");
    // 2. Fetch baseline checklist
    console.log("\nFetching baseline cleaning checklist...");
    const mockReqChecklist = {
        pg: { id: pg.id },
        params: { pgId: pg.id }
    };
    let checklist = null;
    const mockResChecklist = {
        status: (code) => {
            return {
                json: (res) => {
                    if (code !== 200) {
                        console.error(`Checklist fetch failed:`, res);
                    }
                    checklist = res.data;
                }
            };
        }
    };
    await (0, operationsController_1.getCleaningChecklist)(mockReqChecklist, mockResChecklist);
    console.log(`Baseline Checklist State:`);
    console.log(`- Rooms Completed: ${checklist.roomsCompleted}`);
    console.log(`- Bathrooms Completed: ${checklist.bathroomsCompleted}`);
    console.log(`- Water Tank Completed: ${checklist.waterTankCompleted}`);
    // 3. Toggle a field
    console.log("\nToggling 'roomsCompleted' task...");
    const mockReqToggleRooms = {
        pg: { id: pg.id },
        params: { pgId: pg.id },
        body: { field: 'roomsCompleted' }
    };
    let updatedChecklist = null;
    const mockResToggleRooms = {
        status: (code) => {
            return {
                json: (res) => {
                    updatedChecklist = res.data;
                }
            };
        }
    };
    await (0, operationsController_1.toggleCleaningChecklist)(mockReqToggleRooms, mockResToggleRooms);
    console.log(`Updated state: Rooms Completed = ${updatedChecklist.roomsCompleted}`);
    if (updatedChecklist.roomsCompleted !== !checklist.roomsCompleted) {
        throw new Error("FAIL: roomsCompleted did not toggle correctly!");
    }
    console.log(">>> SUCCESS: roomsCompleted toggled successfully!");
    // 4. Toggle another field
    console.log("\nToggling 'bathroomsCompleted' task...");
    const mockReqToggleBathrooms = {
        pg: { id: pg.id },
        params: { pgId: pg.id },
        body: { field: 'bathroomsCompleted' }
    };
    await (0, operationsController_1.toggleCleaningChecklist)(mockReqToggleBathrooms, mockResToggleRooms);
    console.log(`Updated state: Bathrooms Completed = ${updatedChecklist.bathroomsCompleted}`);
    if (!updatedChecklist.bathroomsCompleted) {
        throw new Error("FAIL: bathroomsCompleted did not toggle to true!");
    }
    console.log(">>> SUCCESS: bathroomsCompleted toggled successfully!");
    // 5. Reset Checklist
    console.log("\nResetting the daily cleaning checklist...");
    const mockReqReset = {
        pg: { id: pg.id },
        params: { pgId: pg.id }
    };
    let resetChecklist = null;
    const mockResReset = {
        status: (code) => {
            return {
                json: (res) => {
                    resetChecklist = res.data;
                }
            };
        }
    };
    await (0, operationsController_1.resetCleaningChecklist)(mockReqReset, mockResReset);
    console.log(`Reset states:`);
    console.log(`- Rooms Completed: ${resetChecklist.roomsCompleted}`);
    console.log(`- Bathrooms Completed: ${resetChecklist.bathroomsCompleted}`);
    if (resetChecklist.roomsCompleted || resetChecklist.bathroomsCompleted) {
        throw new Error("FAIL: Checklist did not reset all fields to false!");
    }
    console.log(">>> SUCCESS: Daily cleaning checklist reset successfully!");
    // 6. Test Operations Summary API
    console.log("\nFetching operations command center summary...");
    const mockReqSummary = {
        pg: { id: pg.id },
        params: { pgId: pg.id }
    };
    let summary = null;
    const mockResSummary = {
        status: (code) => {
            return {
                json: (res) => {
                    if (code !== 200) {
                        console.error(`Operations summary fetch failed:`, res);
                    }
                    summary = res.data;
                }
            };
        }
    };
    await (0, operationsController_1.getOperationsSummary)(mockReqSummary, mockResSummary);
    console.log(`Operations Summary:`);
    console.log(`- Rent Due count: ${summary.rentDueCount}, total amount: ₹${summary.rentDueAmount}`);
    console.log(`- Deposit Pending count: ${summary.depositPendingCount}, total amount: ₹${summary.depositPendingAmount}`);
    console.log(`- Damage Recoveries count: ${summary.damageRecoveriesCount}, total amount: ₹${summary.damageRecoveriesAmount}`);
    console.log(`- Complaints Pending count: ${summary.complaintsPendingCount}`);
    console.log(`- Move-Ins count: ${summary.moveInsCount}`);
    console.log(`- Move-Outs count: ${summary.moveOutsCount}`);
    if (typeof summary.rentDueCount !== 'number' || typeof summary.rentDueAmount !== 'number') {
        throw new Error("FAIL: Operations summary properties are invalid!");
    }
    console.log(">>> SUCCESS: Operations summary returned correct statistical datatypes!");
    // 7. Test Follow-Ups API
    console.log("\nFetching Follow-Up Center items list...");
    const mockReqFollowUps = {
        pg: { id: pg.id },
        params: { pgId: pg.id }
    };
    let followUpsList = [];
    const mockResFollowUps = {
        status: (code) => {
            return {
                json: (res) => {
                    followUpsList = res.data;
                }
            };
        }
    };
    await (0, operationsController_1.getFollowUps)(mockReqFollowUps, mockResFollowUps);
    console.log(`Follow-Ups Items Count: ${followUpsList.length}`);
    if (followUpsList.length > 0) {
        console.log(`First urgent follow-up action:`);
        console.log(`- Resident: ${followUpsList[0].residentName}`);
        console.log(`- Type: ${followUpsList[0].type}`);
        console.log(`- Amount Owed: ₹${followUpsList[0].amount}`);
        console.log(`- Overdue Days: ${followUpsList[0].daysOverdue}`);
    }
    console.log(">>> SUCCESS: Follow-Ups API fetched and sorted successfully!");
    // 8. Cleanup checklist
    await prisma_1.default.cleaningChecklist.delete({ where: { pgId: pg.id } });
    console.log("\nTest checklist cleaned up successfully.");
}
runTest()
    .then(() => {
    console.log("\n=================================================");
    console.log("ALL SPRINT 4 CHECKLIST & SUMMARY TESTS PASSED!");
    console.log("=================================================");
    process.exit(0);
})
    .catch((err) => {
    console.error("TEST ERROR:", err);
    process.exit(1);
});
//# sourceMappingURL=test-sprint4.js.map