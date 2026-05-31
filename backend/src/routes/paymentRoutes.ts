import { Router } from 'express';
import { generateLink, getLinkDetails, webhook, simulatePaymentLinkCheckout } from '../controllers/paymentController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// 1. Razorpay Webhook Callback (Open - authenticated internally via signature)
router.post('/razorpay/webhook', webhook);

// 2. Generate Payment Link (Secure - requires authenticated session)
router.post('/link/generate', requireAuth as any, generateLink);

// 3. Retrieve Payment Link Details (Open - called by tenant checkout page)
router.get('/link/details/:referenceId', getLinkDetails);

// 4. Simulate Checkout (Secure/Dev Helper)
router.post('/simulate-checkout', simulatePaymentLinkCheckout);

export default router;
