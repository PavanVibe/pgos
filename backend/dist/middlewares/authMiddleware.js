"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachOrgContext = exports.requireAuth = void 0;
const requireAuth = (req, res, next) => {
    req.auth = { userId: null, orgId: null };
    return next();
};
exports.requireAuth = requireAuth;
const attachOrgContext = (req, res, next) => {
    const { auth } = req;
    if (auth && auth.orgId) {
        req.headers['x-org-id'] = auth.orgId;
    }
    next();
};
exports.attachOrgContext = attachOrgContext;
//# sourceMappingURL=authMiddleware.js.map