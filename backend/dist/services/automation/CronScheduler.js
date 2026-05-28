"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const MonthlyInvoiceService_1 = require("./MonthlyInvoiceService");
const OverdueService_1 = require("./OverdueService");
class CronScheduler {
    static isInitialized = false;
    /**
     * Initializes cron automation jobs on backend start.
     * Safe-guarded against double execution.
     */
    static init() {
        if (this.isInitialized) {
            console.log('[CronScheduler] Already initialized. Skipping initialization.');
            return;
        }
        console.log('[CronScheduler] Initializing proactive PG coordination cron jobs...');
        // 1. Monthly Invoice Generator
        // Runs at 00:00 on day-of-month 1: "0 0 1 * *"
        node_cron_1.default.schedule('0 0 1 * *', async () => {
            console.log('[CronScheduler] Triggering monthly invoice generation cron job...');
            try {
                const result = await MonthlyInvoiceService_1.MonthlyInvoiceService.generateMonthlyInvoices('cron-invoicing');
                console.log(`[CronScheduler] Monthly invoice cron success. Generated: ${result.generated}, Skipped: ${result.skipped}`);
            }
            catch (err) {
                console.error('[CronScheduler] ERROR inside monthly invoice cron job:', err);
            }
        });
        console.log('[CronScheduler] Scheduled: Monthly Invoices (0 0 1 * *)');
        // 2. Overdue Scanner
        // Runs daily at 00:00: "0 0 * * *"
        node_cron_1.default.schedule('0 0 * * *', async () => {
            console.log('[CronScheduler] Triggering daily overdue scanning cron job...');
            try {
                const result = await OverdueService_1.OverdueService.scanAndProcessOverdueInvoices('cron-overdue');
                console.log(`[CronScheduler] Overdue scanner cron success. Transitioned: ${result.transitioned}`);
            }
            catch (err) {
                console.error('[CronScheduler] ERROR inside overdue scanner cron job:', err);
            }
        });
        console.log('[CronScheduler] Scheduled: Overdue Payment Scanner (0 0 * * *)');
        this.isInitialized = true;
        console.log('[CronScheduler] All PGOS proactive automation crons successfully registered.');
    }
}
exports.CronScheduler = CronScheduler;
//# sourceMappingURL=CronScheduler.js.map