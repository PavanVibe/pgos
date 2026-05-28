"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3000',
        'https://pgos-git-main-pavan-pgos-projects20.vercel.app',
        'https://pgos-two.vercel.app',
    ],
    credentials: true,
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// Routes
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