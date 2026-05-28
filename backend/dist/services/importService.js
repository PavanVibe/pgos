"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importPGDataFromExcel = void 0;
const xlsx = __importStar(require("xlsx"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const importPGDataFromExcel = async (pgId, actorId, fileBuffer) => {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);
    if (!rows || rows.length === 0) {
        throw new Error('Excel file is empty or invalid.');
    }
    return prisma_1.default.$transaction(async (tx) => {
        let importedRooms = 0;
        let importedBeds = 0;
        // Group rows by room
        const roomsMap = new Map();
        for (const row of rows) {
            if (!row.RoomNumber || !row.BedNumber || !row.Rent) {
                throw new Error(`Invalid row detected: ${JSON.stringify(row)}`);
            }
            const key = `${row.Floor}-${row.RoomNumber}`;
            if (!roomsMap.has(key)) {
                roomsMap.set(key, []);
            }
            roomsMap.get(key).push(row);
        }
        // Insert rooms and beds
        for (const [key, bedRows] of roomsMap.entries()) {
            const firstRow = bedRows[0];
            // Check if room exists
            let room = await tx.room.findFirst({
                where: { pgId, number: String(firstRow.RoomNumber), floor: String(firstRow.Floor), isActive: true }
            });
            if (!room) {
                room = await tx.room.create({
                    data: {
                        pgId,
                        number: String(firstRow.RoomNumber),
                        floor: String(firstRow.Floor),
                        capacity: firstRow.Capacity || bedRows.length,
                        createdBy: actorId,
                        updatedBy: actorId
                    }
                });
                importedRooms++;
            }
            // Insert beds for this room
            for (const row of bedRows) {
                // Check if bed exists
                const bedExists = await tx.bed.findFirst({
                    where: { roomId: room.id, bedNumber: String(row.BedNumber), isActive: true }
                });
                if (!bedExists) {
                    await tx.bed.create({
                        data: {
                            roomId: room.id,
                            bedNumber: String(row.BedNumber),
                            monthlyRent: Number(row.Rent),
                            createdBy: actorId,
                            updatedBy: actorId
                        }
                    });
                    importedBeds++;
                }
            }
        }
        // Audit log
        await tx.auditLog.create({
            data: {
                actorId,
                action: 'EXCEL_IMPORT',
                entityType: 'PG',
                entityId: pgId,
                metadata: { importedRooms, importedBeds, totalRowsProcessed: rows.length }
            }
        });
        return { importedRooms, importedBeds };
    });
};
exports.importPGDataFromExcel = importPGDataFromExcel;
//# sourceMappingURL=importService.js.map