import { Request, Response } from 'express';
export declare const addStaff: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getStaffList: (req: Request, res: Response) => Promise<void>;
export declare const deactivateStaff: (req: Request, res: Response) => Promise<void>;
export declare const payStaffSalary: (req: Request, res: Response) => Promise<void>;
export declare const getStaffDetails: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=staffController.d.ts.map