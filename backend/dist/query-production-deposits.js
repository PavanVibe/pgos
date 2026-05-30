"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
async function main() {
    const liveUrl = "https://pgos-production-d612.up.railway.app/api";
    const pgId = "03e871c7-5e4d-420f-bd60-384befd56bbe"; // "my home" PG
    console.log("=== REMOTE PRODUCTION DEPOSIT LEDGER DEEP AUDIT ===");
    try {
        const res = await fetch(`${liveUrl}/pgs/${pgId}/dashboard/deposits/ledger`);
        const data = await res.json();
        const ledger = data?.data || [];
        console.log(`Total residents in ledger: ${ledger.length}`);
        for (const r of ledger) {
            console.log(`\nResident: ${r.residentName}`);
            console.log(`  - Profile ID: ${r.id}`);
            console.log(`  - Room/Bed: ${r.roomNumber} (${r.bedNumber})`);
            console.log(`  - Deposit Amount: ₹${r.depositAmount}`);
            console.log(`  - Deposit Status: ${r.status}`);
            console.log(`  - tenantStatus: ${r.tenantStatus}`);
            console.log(`  - invoiceId: ${r.invoiceId}`);
            console.log(`  - pendingAmount: ₹${r.pendingAmount}`);
            // Query full profile stay invoices
            const profRes = await fetch(`${liveUrl}/tenants/profiles/${r.id}`);
            const profData = await profRes.json();
            const invoices = profData?.data?.invoices || [];
            console.log(`  - Total invoices in stay ledger: ${invoices.length}`);
            for (const inv of invoices) {
                console.log(`    * Invoice ID: ${inv.id}, Type: ${inv.type}, Status: ${inv.status}, Amount: ₹${inv.amount}`);
            }
        }
    }
    catch (err) {
        console.error("Audit error:", err.message);
    }
}
main().catch(console.error);
//# sourceMappingURL=query-production-deposits.js.map