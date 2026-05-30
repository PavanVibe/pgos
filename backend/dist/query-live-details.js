"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
async function main() {
    const liveUrl = "https://pgos-production-d612.up.railway.app/api";
    const interestProfiles = [
        { name: 'sumith', id: '92cfa5b4-fac5-401d-bb63-275445b123e6' },
        { name: 'Annayya', id: '620ddbaa-6497-4f49-9948-985550062ab6' },
        { name: 'Mummy', id: '1a02d336-d1b4-49ce-a419-1c83325f40ca' },
        { name: 'sriyu', id: '16349693-31af-489b-97c5-6d457a20be64' }
    ];
    console.log("=== GATHERING REAL RESIDENT PROFILE DETAILS ===");
    for (const item of interestProfiles) {
        console.log(`\n--------------------------------------`);
        console.log(`Resident: ${item.name} (Profile ID: ${item.id})`);
        console.log(`--------------------------------------`);
        try {
            const res = await fetch(`${liveUrl}/tenants/profiles/${item.id}`);
            console.log(`Fetch Profile Status: ${res.status}`);
            const data = await res.json();
            const profile = data?.data;
            if (!profile) {
                console.log(`Could not load profile data for ${item.name}`);
                continue;
            }
            console.log(`1. globalTenantId: ${profile.globalTenantId}`);
            console.log(`2. Current room and bed: Room ${profile.room?.number || profile.historicalRoomNumber} (Bed ${profile.bed?.bedNumber || profile.historicalBedNumber})`);
            console.log(`3. DB Profile Status: ${profile.status}`);
            // Now query the global tenant's full profile list if available, or query all ledger rows to see stay history
            console.log(`Fetching deposits ledger to count stay records for this globalTenantId...`);
            const pgId = "03e871c7-5e4d-420f-bd60-384befd56bbe"; // "my home" PG
            const ledgerRes = await fetch(`${liveUrl}/pgs/${pgId}/dashboard/deposits/ledger`);
            const ledgerData = await ledgerRes.json();
            const ledgerRows = ledgerData?.data || [];
            // Filter all rows belonging to the same resident (by phone number matching since globalTenantId isn't on row)
            const sameResidentRows = ledgerRows.filter((r) => r.phone === profile.globalTenant?.phone);
            console.log(`4. Total stay records in ledger: ${sameResidentRows.length}`);
            for (const row of sameResidentRows) {
                console.log(`   - Profile ID: ${row.id}, Room/Bed: Room ${row.roomNumber} (${row.bedNumber}), status: ${row.status}, tenantStatus (DB status): ${row.tenantStatus}`);
            }
        }
        catch (err) {
            console.error(`Error for ${item.name}:`, err.message);
        }
    }
}
main().catch(console.error);
//# sourceMappingURL=query-live-details.js.map