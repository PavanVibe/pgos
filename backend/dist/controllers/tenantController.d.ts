import { Request, Response } from 'express';
export declare const searchByPhone: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const onboard: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const lockBedForOnboarding: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const vacate: (req: Request, res: Response) => Promise<void>;
export declare const getResidentProfile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=tenantController.d.ts.map