"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const dashboardService_1 = require("./services/dashboardService");
const prisma_1 = __importDefault(require("./utils/prisma"));
async function main() {
    const pgId = '13007fcc-2c7d-4fb1-98c6-19e07ba06363';
    const orgId = 'some-org-id';
    console.log("Fetching summary for PG ID:", pgId);
    try {
        const pg = await prisma_1.default.pG.findFirst();
        if (!pg) {
            console.log("No PG found in database.");
            return;
        }
        console.log(`Found PG: ${pg.name} (${pg.id}), OrgId: ${pg.organizationId}`);
        const summary = await (0, dashboardService_1.getPGDashboardSummary)(pg.id, pg.organizationId);
        console.log("Dashboard Summary Result:", JSON.stringify(summary, null, 2));
    }
    catch (error) {
        console.error("Error fetching summary:", error);
    }
}
main();
//# sourceMappingURL=test-dashboard.js.map