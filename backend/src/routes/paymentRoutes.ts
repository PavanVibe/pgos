import { Router } from 'express';
import { generateLink, webhook, simulatePaymentLinkCheckout } from '../controllers/paymentController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// 1. Razorpay Webhook Callback (Open - authenticated internally via signature)
router.post('/razorpay/webhook', webhook);

// 2. Generate Payment Link (Secure - requires authenticated session)
router.post('/link/generate', requireAuth as any, generateLink);

// 3. Simulate Checkout (Secure/Dev Helper)
router.post('/simulate-checkout', simulatePaymentLinkCheckout);

export default router;
