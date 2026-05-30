"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
async function main() {
    const liveUrl = "https://pgos-production-d612.up.railway.app/api";
    console.log("=== LIVE PRODUCTION PG DISCOVERY ===");
    try {
        const res = await fetch(`${liveUrl}/pgs`);
        console.log(`PG List HTTP Status: ${res.status}`);
        const pgData = await res.json();
        console.log("PG list data:", JSON.stringify(pgData, null, 2));
        const pgs = pgData?.data || [];
        if (pgs.length === 0) {
            console.log("No PGs discovered in the production context.");
            return;
        }
        for (const pg of pgs) {
            console.log(`\nQuerying Deposit Ledger for PG: ${pg.name} (ID: ${pg.id})`);
            const ledgerRes = await fetch(`${liveUrl}/pgs/${pg.id}/dashboard/deposits/ledger`);
            console.log(`Ledger HTTP Status: ${ledgerRes.status}`);
            const ledgerData = await ledgerRes.json();
            const rows = ledgerData?.data || [];
            console.log(`Total ledger rows: ${rows.length}`);
            // Filter rows of interest
            const interestNames = ['sumith', 'Annayya', 'Mummy', 'sriyu'];
            const matchingRows = rows.filter((r) => interestNames.some(name => r.residentName.toLowerCase().includes(name.toLowerCase())));
            console.log(`Matching production rows for target residents: ${matchingRows.length}`);
            for (const r of matchingRows) {
                console.log(JSON.stringify(r, null, 2));
            }
        }
    }
    catch (err) {
        console.error("Discovery error:", err.message);
    }
}
main().catch(console.error);
//# sourceMappingURL=query-live-production.js.map