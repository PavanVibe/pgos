"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({ origin: '*', credentials: false }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'PGOS API is running.' });
});
const pgRoutes_1 = __importDefault(require("./routes/pgRoutes"));
const tenantRoutes_1 = __importDefault(require("./routes/tenantRoutes"));
app.use('/api/pgs', pgRoutes_1.default);
app.use('/api/tenants', tenantRoutes_1.default);
const CronScheduler_1 = require("./services/automation/CronScheduler");
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    CronScheduler_1.CronScheduler.init();
});
//# sourceMappingURL=index.js.map