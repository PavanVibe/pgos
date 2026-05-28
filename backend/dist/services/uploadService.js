"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignedDocumentUrl = exports.generateUploadSignature = void 0;
const cloudinary_1 = __importDefault(require("../utils/cloudinary"));
const generateUploadSignature = () => {
    const timestamp = Math.round((new Date).getTime() / 1000);
    const paramsToSign = {
        timestamp,
        folder: 'pgos_uploads'
    };
    const signature = cloudinary_1.default.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
    return {
        timestamp,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder: 'pgos_uploads'
    };
};
exports.generateUploadSignature = generateUploadSignature;
const generateSignedDocumentUrl = (publicId) => {
    // Generates a short-lived URL for private KYC docs
    return cloudinary_1.default.utils.private_download_url(publicId, 'jpg', { expires_at: Math.floor(Date.now() / 1000) + 900 } // 15 mins expiry
    );
};
exports.generateSignedDocumentUrl = generateSignedDocumentUrl;
//# sourceMappingURL=uploadService.js.map