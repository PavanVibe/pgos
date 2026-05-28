"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignedDocumentUrl = exports.getUploadSignature = void 0;
const uploadService_1 = require("../services/uploadService");
const getUploadSignature = (req, res) => {
    try {
        const signatureData = (0, uploadService_1.generateUploadSignature)();
        res.status(200).json({ status: 'success', data: signatureData });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate upload signature.' });
    }
};
exports.getUploadSignature = getUploadSignature;
const getSignedDocumentUrl = (req, res) => {
    try {
        const { publicId } = req.query;
        if (!publicId || typeof publicId !== 'string') {
            return res.status(400).json({ error: 'publicId is required.' });
        }
        const url = (0, uploadService_1.generateSignedDocumentUrl)(publicId);
        res.status(200).json({ status: 'success', data: { url } });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate signed URL.' });
    }
};
exports.getSignedDocumentUrl = getSignedDocumentUrl;
//# sourceMappingURL=uploadController.js.map