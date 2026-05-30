"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivity = exports.getOccupancy = exports.getTasks = void 0;
const OperationalSummaryService_1 = require("../services/OperationalSummaryService");
const getTasks = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const tasks = await OperationalSummaryService_1.OperationalSummaryService.getTasksSummary(pgId);
        res.status(200).json({ status: 'success', data: tasks });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getTasks = getTasks;
const getOccupancy = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const occupancy = await OperationalSummaryService_1.OperationalSummaryService.getOccupancySummary(pgId);
        res.status(200).json({ status: 'success', data: occupancy });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getOccupancy = getOccupancy;
const getActivity = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const activity = await OperationalSummaryService_1.OperationalSummaryService.getActivityFeed(pgId);
        res.status(200).json({ status: 'success', data: activity });
    }
    catch (error) {
        console.error("GET ACTIVITY ERROR:", error);
        res.status(400).json({ error: error.message });
    }
};
exports.getActivity = getActivity;
//# sourceMappingURL=dashboardDataController.js.map