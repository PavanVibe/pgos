"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachOrgContext = exports.requireAuth = void 0;
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
const clerkAuth = (0, clerk_sdk_node_1.ClerkExpressRequireAuth)({});
// This middleware ensures the user is authenticated via Clerk
const requireAuth = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || !process.env.CLERK_SECRET_KEY) {
        // Attach dev auth context
        req.auth = { userId: 'dev-user-id', orgId: 'dev-org-id' };
        return next();
    }
    return clerkAuth(req, res, next);
};
exports.requireAuth = requireAuth;
// Middleware to attach organization context if available
const attachOrgContext = (req, res, next) => {
    // @ts-ignore
    const { auth } = req;
    if (auth && auth.orgId) {
        req.headers['x-org-id'] = auth.orgId;
    }
    next();
};
exports.attachOrgContext = attachOrgContext;
//# sourceMappingURL=authMiddleware.js.map