"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = void 0;
const dashboardService_1 = require("../services/dashboardService");
const getDashboardSummary = async (req, res) => {
    try {
        const org = req.organization;
        const { pgId } = req.params;
        const summary = await (0, dashboardService_1.getPGDashboardSummary)(pgId, org.id);
        res.status(200).json({ status: 'success', data: summary });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getDashboardSummary = getDashboardSummary;
//# sourceMappingURL=dashboardController.js.map