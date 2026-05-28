"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function main() {
    console.log("Fetching dashboard summary via HTTP...");
    try {
        const res = await fetch("http://localhost:5000/api/pgs/13007fcc-2c7d-4fb1-98c6-19e07ba06363/dashboard/summary");
        console.log("HTTP Response Status:", res.status);
        const json = await res.json();
        console.log("HTTP Response JSON:", JSON.stringify(json, null, 2));
    }
    catch (err) {
        console.error("HTTP Fetch Error:", err);
    }
}
main();
//# sourceMappingURL=test-http.js.map