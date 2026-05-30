"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function main() {
    const pgId = "demo-pg-123";
    const baseUrl = `http://localhost:5000/api/pgs/${pgId}/dashboard/collections-history`;
    console.log("=== TESTING COLLECTIONS HISTORY ENDPOINT ===");
    try {
        const res = await fetch(baseUrl);
        console.log("History Status:", res.status);
        const json = (await res.json());
        console.log("History Data Count:", json.data?.length ?? 0);
        if (json.data && json.data.length > 0) {
            console.log("First Month Record:", JSON.stringify(json.data[0], null, 2));
            const first = json.data[0];
            console.log(`\n=== TESTING MONTHLY LEDGER ENDPOINT FOR ${first.month} ${first.year} ===`);
            const ledgerUrl = `${baseUrl}/${first.year}/${first.monthIndex}`;
            const ledgerRes = await fetch(ledgerUrl);
            console.log("Ledger Status:", ledgerRes.status);
            const ledgerJson = (await ledgerRes.json());
            console.log("Ledger Rows Count:", ledgerJson.data?.length ?? 0);
            if (ledgerJson.data && ledgerJson.data.length > 0) {
                console.log("First Ledger Row:", JSON.stringify(ledgerJson.data[0], null, 2));
            }
        }
    }
    catch (err) {
        console.error("Test Error:", err.message);
    }
}
main();
//# sourceMappingURL=test-history.js.map