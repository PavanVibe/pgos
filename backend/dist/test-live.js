"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function main() {
    const liveUrl = "https://pgos-production-d612.up.railway.app";
    console.log("=== LIVE HEALTH HEADERS ===");
    try {
        const res = await fetch(`${liveUrl}/health`);
        console.log("Health Status:", res.status);
        for (const [key, value] of res.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }
    }
    catch (err) {
        console.error("Health Fetch Error:", err.message);
    }
}
main();
//# sourceMappingURL=test-live.js.map