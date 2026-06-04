"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const tenantController_1 = require("../controllers/tenantController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// 1. Razorpay Webhook Callback (Open - authenticated internally via signature)
router.post('/razorpay/webhook', paymentController_1.webhook);
// 2. Generate Payment Link (Secure - requires authenticated session)
router.post('/link/generate', authMiddleware_1.requireAuth, paymentController_1.generateLink);
// 3. Retrieve Payment Link Details (Open - called by tenant checkout page)
router.get('/link/details/:referenceId', paymentController_1.getLinkDetails);
// 4. Retrieve Public Tenant Profile (Open - called by tenant portal)
router.get('/tenant/profile/:profileId', tenantController_1.getResidentProfile);
// 5. Simulate Checkout (Secure/Dev Helper)
router.post('/simulate-checkout', paymentController_1.simulatePaymentLinkCheckout);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map