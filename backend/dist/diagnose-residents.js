"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./utils/prisma"));
async function main() {
    console.log("=== ALL PGs ===");
    const pgs = await prisma_1.default.pG.findMany({});
    console.log(`Total PGs: ${pgs.length}`);
    for (const pg of pgs) {
        console.log(`- PG: ${pg.name} (ID: ${pg.id})`);
    }
    console.log("\n=== ALL ROOMS ===");
    const rooms = await prisma_1.default.room.findMany({});
    console.log(`Total Rooms: ${rooms.length}`);
    for (const r of rooms) {
        console.log(`- Room: ${r.number} (ID: ${r.id}, PG ID: ${r.pgId})`);
    }
    console.log("\n=== ALL BEDS ===");
    const beds = await prisma_1.default.bed.findMany({
        include: {
            tenantProfile: {
                include: {
                    globalTenant: true
                }
            }
        }
    });
    console.log(`Total Beds: ${beds.length}`);
    for (const b of beds) {
        console.log(`- Bed: ${b.bedNumber} (ID: ${b.id}, Room ID: ${b.roomId}, Occupied By: ${b.tenantProfile?.globalTenant?.name || 'Vacant'}, Profile Status: ${b.tenantProfile?.status || 'N/A'})`);
    }
    console.log("\n=== ALL PROFILES ===");
    const profiles = await prisma_1.default.pGTenantProfile.findMany({
        include: {
            globalTenant: true,
            room: true,
            bed: true
        }
    });
    for (const p of profiles) {
        console.log(`- Profile: ${p.globalTenant.name}`);
        console.log(`  Profile ID: ${p.id}`);
        console.log(`  Bed Assigned: ${p.bed?.bedNumber || 'None'}`);
        console.log(`  Room Assigned: ${p.room?.number || 'None'}`);
        console.log(`  Status: ${p.status}`);
        console.log(`  isActive: ${p.isActive}`);
    }
}
main().catch(console.error);
//# sourceMappingURL=diagnose-residents.js.map