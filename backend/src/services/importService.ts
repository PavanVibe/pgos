import * as xlsx from 'xlsx';
import prisma from '../utils/prisma';

interface ImportRow {
  Floor: string;
  RoomNumber: string;
  BedNumber: string;
  Rent: number;
  Capacity: number;
}

export const importPGDataFromExcel = async (pgId: string, actorId: string, fileBuffer: Buffer) => {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName as string];
  
  const rows: ImportRow[] = xlsx.utils.sheet_to_json(sheet!);
  
  if (!rows || rows.length === 0) {
    throw new Error('Excel file is empty or invalid.');
  }

  return prisma.$transaction(async (tx) => {
    let importedRooms = 0;
    let importedBeds = 0;

    // Group rows by room
    const roomsMap = new Map<string, ImportRow[]>();
    for (const row of rows) {
      if (!row.RoomNumber || !row.BedNumber || !row.Rent) {
        throw new Error(`Invalid row detected: ${JSON.stringify(row)}`);
      }
      const key = `${row.Floor}-${row.RoomNumber}`;
      if (!roomsMap.has(key)) {
        roomsMap.set(key, []);
      }
      roomsMap.get(key)!.push(row);
    }

    // Insert rooms and beds
    for (const [key, bedRows] of roomsMap.entries()) {
      const firstRow = bedRows[0]!;
      
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
