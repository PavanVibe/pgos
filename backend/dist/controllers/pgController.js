"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTenantNoteManual = exports.sendReminderManual = exports.getOverdueResidentsManual = exports.scanOverdueManual = exports.generateInvoicesManual = exports.getRoomHistory = exports.getPGComplaint = exports.getPGComplaints = exports.resolveComplaint = exports.createComplaint = exports.payRent = exports.getPGRooms = exports.allocateBedController = exports.getOrganizationPGs = exports.createPG = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../utils/prisma"));
const bedService_1 = require("../services/bedService");
const zod_1 = require("zod");
const MonthlyInvoiceService_1 = require("../services/automation/MonthlyInvoiceService");
const OverdueService_1 = require("../services/automation/OverdueService");
const WhatsAppService_1 = require("../services/notifications/WhatsAppService");
const createPGSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    city: zod_1.z.string(),
    address: zod_1.z.string().optional()
});
const createPG = async (req, res) => {
    try {
        const org = req.organization;
        const { name, city, address } = createPGSchema.parse(req.body);
        const pg = await prisma_1.default.pG.create({
            data: {
                organizationId: org.id,
                name,
                city,
                address,
                createdBy: req.auth?.userId
            }
        });
        res.status(201).json({ status: 'success', data: pg });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Invalid Request' });
    }
};
exports.createPG = createPG;
const getOrganizationPGs = async (req, res) => {
    try {
        const org = req.organization;
        const pgs = await prisma_1.default.pG.findMany({
            where: { organizationId: org.id },
            include: {
                _count: {
                    select: { rooms: true, tenantProfiles: true }
                }
            }
        });
        res.status(200).json({ status: 'success', data: pgs });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getOrganizationPGs = getOrganizationPGs;
const allocateBedController = async (req, res) => {
    try {
        const { pgId } = req.params;
        const { bedId, globalTenantId, securityDeposit, moveInDate } = req.body;
        const actorId = req.auth?.userId || 'system';
        const profile = await (0, bedService_1.allocateBed)(bedId, globalTenantId, pgId, securityDeposit, new Date(moveInDate), actorId);
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.allocateBedController = allocateBedController;
// --- Operations Integration ---
const PayRentWorkflow_1 = require("../services/workflows/PayRentWorkflow");
const RaiseComplaintWorkflow_1 = require("../services/workflows/RaiseComplaintWorkflow");
const ResolveComplaintWorkflow_1 = require("../services/workflows/ResolveComplaintWorkflow");
/**
 * Fetches all rooms and beds in the PG, including active occupants, to power the onboarding bed grid.
 */
const getPGRooms = async (req, res) => {
    try {
        const { pgId } = req.params;
        const rooms = await prisma_1.default.room.findMany({
            where: { pgId: pgId, isActive: true },
            include: {
                beds: {
                    where: { isActive: true },
                    include: {
                        tenantProfile: {
                            where: { status: { in: ['ACTIVE', 'INCOMPLETE', 'NOTICE'] } },
                            select: {
                                id: true,
                                status: true,
                                securityDeposit: true,
                                moveInDate: true,
                                globalTenant: {
                                    select: {
                                        name: true,
                                        phone: true,
                                        email: true,
                                    }
                                },
                                invoices: {
                                    where: {
                                        status: { in: ['PENDING', 'PAST_DUE'] }
                                    },
                                    select: {
                                        id: true,
                                        amount: true,
                                        status: true,
                                        dueDate: true
                                    }
                                },
                                complaints: {
                                    select: {
                                        id: true,
                                        status: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { number: 'asc' }
        });
        res.status(200).json({ status: 'success', data: rooms });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getPGRooms = getPGRooms;
const payRent = async (req, res) => {
    try {
        const { pgId, tenantId } = req.params;
        const { method, amount, invoiceId } = req.body;
        const actorId = req.auth?.userId || 'system';
        if (!method || (method !== 'upi' && method !== 'cash')) {
            return res.status(400).json({ error: 'Valid payment method (upi/cash) is required.' });
        }
        const parsedAmount = amount !== undefined && amount !== null ? parseFloat(amount) : undefined;
        const updatedInvoice = await PayRentWorkflow_1.PayRentWorkflow.execute(pgId, tenantId, method, actorId, parsedAmount, invoiceId);
        res.status(200).json({ status: 'success', data: updatedInvoice });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.payRent = payRent;
/**
 * Creates a new complaint for a PG room/area.
 */
const createComplaint = async (req, res) => {
    try {
        const { pgId } = req.params;
        const { roomOrArea, description, priority, category } = req.body;
        const actorId = req.auth?.userId || 'system';
        if (!roomOrArea || !description || !priority) {
            return res.status(400).json({ error: 'roomOrArea, description, and priority are required.' });
        }
        const complaint = await RaiseComplaintWorkflow_1.RaiseComplaintWorkflow.execute(pgId, roomOrArea, description, priority, category, actorId);
        res.status(200).json({ status: 'success', data: complaint });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.createComplaint = createComplaint;
/**
 * Resolves an existing complaint.
 */
const resolveComplaint = async (req, res) => {
    try {
        const { pgId, complaintId } = req.params;
        const actorId = req.auth?.userId || 'system';
        const updatedComplaint = await ResolveComplaintWorkflow_1.ResolveComplaintWorkflow.execute(pgId, complaintId, actorId);
        res.status(200).json({ status: 'success', data: updatedComplaint });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.resolveComplaint = resolveComplaint;
/**
 * Fetches all complaints for a PG, including resident profile and bed details.
 */
const getPGComplaints = async (req, res) => {
    try {
        const { pgId } = req.params;
        const complaints = await prisma_1.default.complaint.findMany({
            where: { pgId: pgId, isActive: true },
            include: {
                tenantProfile: {
                    select: {
                        id: true,
                        status: true,
                        globalTenant: {
                            select: {
                                name: true,
                                phone: true,
                                email: true,
                            }
                        },
                        bed: {
                            select: {
                                bedNumber: true,
                                room: {
                                    select: {
                                        number: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ status: 'success', data: complaints });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getPGComplaints = getPGComplaints;
/**
 * Fetches a single complaint by ID.
 */
const getPGComplaint = async (req, res) => {
    try {
        const { pgId, complaintId } = req.params;
        const complaint = await prisma_1.default.complaint.findFirst({
            where: { id: complaintId, pgId: pgId, isActive: true },
            include: {
                tenantProfile: {
                    select: {
                        id: true,
                        status: true,
                        globalTenant: {
                            select: {
                                name: true,
                                phone: true,
                                email: true,
                            }
                        },
                        bed: {
                            select: {
                                bedNumber: true,
                                room: {
                                    select: {
                                        number: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }
        res.status(200).json({ status: 'success', data: complaint });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getPGComplaint = getPGComplaint;
/**
 * Fetches comprehensive room operational history ledger (beds, current/past occupants, invoices, complaints, operational timeline, and revenue stats).
 */
const getRoomHistory = async (req, res) => {
    const { pgId, roomId } = req.params;
    console.log("pgId", pgId);
    console.log("roomId", roomId);
    let room = null;
    try {
        console.log("Starting room fetch...");
        room = await prisma_1.default.room.findFirst({
            where: { id: roomId, pgId: pgId, isActive: true },
            include: {
                beds: {
                    where: { isActive: true },
                    include: {
                        tenantProfile: {
                            where: { status: { in: ['ACTIVE', 'INCOMPLETE', 'NOTICE'] } },
                            select: {
                                id: true,
                                status: true,
                                securityDeposit: true,
                                moveInDate: true,
                                globalTenant: {
                                    select: {
                                        name: true,
                                        phone: true,
                                        email: true,
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        console.log("room exists", room);
    }
    catch (err) {
        console.error("Error during room fetch:", err);
        return res.status(400).json({ error: `Room fetch failure: ${err.message}` });
    }
    if (!room) {
        return res.status(404).json({ error: 'Room not found or does not belong to this PG.' });
    }
    let profiles = [];
    try {
        console.log("Starting profiles fetch...");
        profiles = await prisma_1.default.pGTenantProfile.findMany({
            where: { roomId: roomId, pgId: pgId, isActive: true },
            include: {
                globalTenant: {
                    select: {
                        name: true,
                        phone: true,
                        email: true
                    }
                },
                bed: {
                    select: {
                        bedNumber: true
                    }
                },
                invoices: {
                    where: { isActive: true },
                    orderBy: { dueDate: 'asc' }
                },
                complaints: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log("profiles", profiles?.length);
    }
    catch (err) {
        console.error("Error during profiles fetch:", err);
        return res.status(400).json({ error: `Profiles fetch failure: ${err.message}` });
    }
    let eventLogs = [];
    try {
        console.log("Starting event logs fetch...");
        const profileIds = profiles.map((p) => p.id);
        const invoiceIds = profiles.flatMap((p) => p.invoices.map((inv) => inv.id));
        const complaintIds = profiles.flatMap((p) => p.complaints.map((c) => c.id));
        eventLogs = await prisma_1.default.eventLog.findMany({
            where: {
                entityId: {
                    in: [...profileIds, ...invoiceIds, ...complaintIds]
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log("eventLogs", eventLogs?.length);
    }
    catch (err) {
        console.error("Error during event logs fetch:", err);
        return res.status(400).json({ error: `Event logs fetch failure: ${err.message}` });
    }
    // 4. Calculate Billing and Revenue Stats
    let totalBilled = 0;
    let totalCollected = 0;
    let totalDues = 0;
    try {
        console.log("Starting finance stats calculation...");
        profiles.forEach((profile) => {
            profile.invoices.forEach((inv) => {
                totalBilled += inv.amount;
                if (inv.status === 'PAID') {
                    totalCollected += inv.amount;
                }
                else {
                    totalDues += inv.amount;
                }
            });
        });
    }
    catch (err) {
        console.error("Error during finance calculation:", err);
        return res.status(400).json({ error: `Finance calculation failure: ${err.message}` });
    }
    // 5. Build Unified Timeline
    let timelineItems = [];
    try {
        console.log("timeline build start");
        timelineItems = eventLogs.map((log) => {
            let type = 'general';
            let title = log.eventType;
            let description = '';
            const metadata = log.metadata || {};
            const invoice = profiles.flatMap((p) => p.invoices).find((i) => i.id === log.entityId);
            const complaint = profiles.flatMap((p) => p.complaints).find((c) => c.id === log.entityId);
            const profile = profiles.find((p) => p.id === log.entityId ||
                (invoice && p.id === invoice.pgTenantId) ||
                (complaint && p.id === complaint.pgTenantId));
            const residentName = profile?.globalTenant?.name || 'Resident';
            const bedObj = room.beds.find((b) => b.id === metadata.bedId);
            const resolvedBedNum = profile?.bed?.bedNumber || profile?.historicalBedNumber || bedObj?.bedNumber || 'N/A';
            if (log.eventType === 'TENANT_MOVED_IN' || log.eventType === 'BED_ALLOCATED') {
                type = 'onboarding';
                title = 'Resident Onboarded';
                description = `${residentName} onboarded to Bed ${resolvedBedNum}`;
            }
            else if (log.eventType === 'TENANT_MOVED_OUT' || log.eventType === 'BED_VACATED') {
                type = 'vacate';
                title = 'Resident Vacated';
                description = `${residentName} vacated the bed`;
            }
            else if (log.eventType === 'RENT_PAID') {
                type = 'payment';
                title = 'Rent Invoice Paid';
                description = `Payment of ₹${invoice?.amount || 'N/A'} received via ${metadata.method || 'cash'}`;
            }
            else if (log.eventType === 'COMPLAINT_CREATED') {
                type = 'complaint';
                title = 'Complaint Raised';
                description = `[${complaint?.category || 'General'}] ${complaint?.description || ''}`;
            }
            else if (log.eventType === 'COMPLAINT_RESOLVED') {
                type = 'complaint-resolved';
                title = 'Complaint Resolved';
                description = `Complaint regarding ${complaint?.category || 'General'} has been resolved`;
            }
            return {
                id: log.id,
                type,
                title,
                description,
                timestamp: log.createdAt
            };
        });
    }
    catch (err) {
        console.error("Error during timeline aggregation:", err);
        return res.status(400).json({ error: `Timeline aggregation failure: ${err.message}` });
    }
    return res.status(200).json({
        status: 'success',
        data: {
            room,
            profiles,
            revenue: {
                totalBilled,
                totalCollected,
                totalDues,
                profitability: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0
            },
            timeline: timelineItems
        }
    });
};
exports.getRoomHistory = getRoomHistory;
/**
 * Manually triggers generation of monthly invoices.
 */
const generateInvoicesManual = async (req, res) => {
    try {
        const actorId = req.auth?.userId || 'system-manual';
        const result = await MonthlyInvoiceService_1.MonthlyInvoiceService.generateMonthlyInvoices(actorId);
        res.status(200).json({ status: 'success', data: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.generateInvoicesManual = generateInvoicesManual;
/**
 * Manually triggers overdue scanning and transitions.
 */
const scanOverdueManual = async (req, res) => {
    try {
        const actorId = req.auth?.userId || 'system-manual';
        const result = await OverdueService_1.OverdueService.scanAndProcessOverdueInvoices(actorId);
        res.status(200).json({ status: 'success', data: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.scanOverdueManual = scanOverdueManual;
/**
 * Retrieves the prioritized list of overdue residents for dashboard widgets.
 */
const getOverdueResidentsManual = async (req, res) => {
    try {
        const { pgId } = req.params;
        const { filter } = req.query;
        // Aligned with the expanded Zustand sheet states
        let statusFilter = [client_1.InvoiceStatus.PAST_DUE];
        if (filter === 'all' || filter === 'chronic') {
            statusFilter = [client_1.InvoiceStatus.PENDING, client_1.InvoiceStatus.PAST_DUE];
        }
        else if (filter === 'due-today') {
            statusFilter = [client_1.InvoiceStatus.PENDING];
        }
        const result = await OverdueService_1.OverdueService.getOverdueResidentsList(pgId, statusFilter, filter);
        res.status(200).json({ status: 'success', data: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getOverdueResidentsManual = getOverdueResidentsManual;
/**
 * Manually dispatches a WhatsApp reminder and logs standard event audit trails.
 */
const sendReminderManual = async (req, res) => {
    try {
        const { tenantProfileId, type } = req.body;
        const actorId = req.auth?.userId || 'system-manual';
        if (!tenantProfileId || !type) {
            return res.status(400).json({ error: 'tenantProfileId and type are required.' });
        }
        // 1. Fetch tenant profile details to build message variables
        const profile = await prisma_1.default.pGTenantProfile.findUnique({
            where: { id: tenantProfileId, isActive: true },
            include: {
                globalTenant: true,
                bed: {
                    select: {
                        bedNumber: true,
                        room: { select: { number: true } }
                    }
                },
                invoices: {
                    where: { status: 'PAST_DUE', isActive: true },
                    orderBy: { dueDate: 'asc' }
                }
            }
        });
        if (!profile) {
            return res.status(404).json({ error: 'Tenant profile not found.' });
        }
        const latestOverdue = profile.invoices[0];
        const amount = latestOverdue ? latestOverdue.amount : 10000; // default/prorated fallback
        const days = latestOverdue ? Math.max(1, Math.floor((Date.now() - new Date(latestOverdue.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 3;
        const variables = {
            name: profile.globalTenant.name || 'Resident',
            amount: amount.toString(),
            room: profile.bed?.room?.number || profile.historicalRoomNumber || 'N/A',
            bed: profile.bed?.bedNumber || profile.historicalBedNumber || 'N/A',
            days: days.toString()
        };
        // 2. Dispatch reminder using WhatsAppService
        const dispatchResult = await WhatsAppService_1.WhatsAppService.sendWhatsAppNotification({
            to: profile.globalTenant.phone,
            templateType: type,
            variables
        });
        // 3. Log RENT_REMINDER_SENT event
        await prisma_1.default.eventLog.create({
            data: {
                entityId: profile.id,
                eventType: 'RENT_REMINDER_SENT',
                metadata: {
                    pgId: profile.pgId,
                    roomId: profile.roomId,
                    bedId: profile.bedId,
                    amount: amount,
                    recipientPhone: profile.globalTenant.phone,
                    template: type,
                    actorId
                }
            }
        });
        res.status(200).json({ status: 'success', data: { dispatchResult, copy: WhatsAppService_1.WhatsAppService.getMessageCopy(type, variables) } });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.sendReminderManual = sendReminderManual;
/**
 * Saves a lightweight tenant note inside the EventLog system.
 */
const saveTenantNoteManual = async (req, res) => {
    try {
        const { pgId, tenantId } = req.params;
        const { note } = req.body;
        const actorId = req.auth?.userId || 'system-manual';
        if (note === undefined || note === null) {
            return res.status(400).json({ error: 'Note content is required.' });
        }
        // Check if profile exists
        const profile = await prisma_1.default.pGTenantProfile.findUnique({
            where: { id: tenantId, isActive: true }
        });
        if (!profile) {
            return res.status(404).json({ error: 'Tenant profile not found.' });
        }
        // Log TENANT_NOTE_UPDATED event
        await prisma_1.default.eventLog.create({
            data: {
                entityId: profile.id,
                eventType: 'TENANT_NOTE_UPDATED',
                metadata: {
                    pgId: profile.pgId,
                    note: note.trim(),
                    actorId
                }
            }
        });
        res.status(200).json({ status: 'success', message: 'Tenant note updated successfully.' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.saveTenantNoteManual = saveTenantNoteManual;
//# sourceMappingURL=pgController.js.map