import { Request, Response } from 'express';
export declare const createPG: (req: Request, res: Response) => Promise<void>;
export declare const getOrganizationPGs: (req: Request, res: Response) => Promise<void>;
export declare const createRoom: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const allocateBedController: (req: Request, res: Response) => Promise<void>;
/**
 * Fetches all rooms and beds in the PG, including active occupants, to power the onboarding bed grid.
 */
export declare const getPGRooms: (req: Request, res: Response) => Promise<void>;
export declare const payRent: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const payDeposit: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Creates a new complaint for a PG room/area.
 */
export declare const createComplaint: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Resolves an existing complaint.
 */
export declare const resolveComplaint: (req: Request, res: Response) => Promise<void>;
/**
 * Fetches all complaints for a PG, including resident profile and bed details.
 */
export declare const getPGComplaints: (req: Request, res: Response) => Promise<void>;
/**
 * Fetches a single complaint by ID.
 */
export declare const getPGComplaint: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Fetches comprehensive room operational history ledger (beds, current/past occupants, invoices, complaints, operational timeline, and revenue stats).
 */
export declare const getRoomHistory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Manually triggers generation of monthly invoices.
 */
export declare const generateInvoicesManual: (req: Request, res: Response) => Promise<void>;
/**
 * Manually triggers overdue scanning and transitions.
 */
export declare const scanOverdueManual: (req: Request, res: Response) => Promise<void>;
/**
 * Retrieves the prioritized list of overdue residents for dashboard widgets.
 */
export declare const getOverdueResidentsManual: (req: Request, res: Response) => Promise<void>;
/**
 * Manually dispatches a WhatsApp reminder and logs standard event audit trails.
 */
export declare const sendReminderManual: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Saves a lightweight tenant note inside the EventLog system.
 */
export declare const saveTenantNoteManual: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=pgController.d.ts.map