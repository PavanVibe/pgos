"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./utils/prisma"));
async function main() {
    console.log("=== LISTING ALL COMPLAINTS IN DATABASE (ANY STATUS) ===\n");
    const complaints = await prisma_1.default.complaint.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            tenantProfile: {
                include: {
                    globalTenant: true
                }
            },
            damageRecoveries: true
        }
    });
    console.log(`Found ${complaints.length} complaints in total:\n`);
    complaints.forEach((comp, idx) => {
        console.log(`[${idx + 1}] ID: ${comp.id}`);
        console.log(`    Description: ${comp.description}`);
        console.log(`    Status: ${comp.status}`);
        console.log(`    Repair Cost: ₹${comp.repairCost}`);
        console.log(`    Responsibility: ${comp.responsibility}`);
        console.log(`    Updated At: ${comp.updatedAt}`);
        console.log(`    Resolved At: ${comp.resolvedAt}`);
        console.log(`    Resident: ${comp.tenantProfile?.globalTenant?.name || 'N/A'}`);
        console.log(`    Damage Recoveries Count: ${comp.damageRecoveries.length}`);
        console.log("----------------------------------------");
    });
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=trace-complaint.js.map