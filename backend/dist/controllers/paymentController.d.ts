import { Request, Response } from 'express';
export declare const generateLink: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getLinkDetails: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const webhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Dev-only simulation endpoint to mock successful Razorpay payment link checkout.
 */
export declare const simulatePaymentLinkCheckout: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Fetch and merge RentInvoices (Rent & Deposit) and DamageRecoveries for a PG
 */
export declare const getUnifiedPayments: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=paymentController.d.ts.map