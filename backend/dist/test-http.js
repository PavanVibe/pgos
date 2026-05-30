"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function main() {
    const pgId = "demo-pg-123";
    console.log("Fetching dashboard summary for demo-pg-123...");
    try {
        const res = await fetch(`http://localhost:5000/api/pgs/${pgId}/dashboard/summary`);
        console.log("Summary HTTP Status:", res.status);
        const json = await res.json();
        console.log("Summary JSON:", JSON.stringify(json, null, 2));
    }
    catch (err) {
        console.error("Summary Fetch Error:", err);
    }
    console.log("\nFetching dashboard tasks for demo-pg-123...");
    try {
        const res = await fetch(`http://localhost:5000/api/pgs/${pgId}/dashboard/tasks`);
        console.log("Tasks HTTP Status:", res.status);
        const json = await res.json();
        console.log("Tasks JSON:", JSON.stringify(json, null, 2));
    }
    catch (err) {
        console.error("Tasks Fetch Error:", err);
    }
}
main();
//# sourceMappingURL=test-http.js.map