export declare const generateUploadSignature: () => {
    timestamp: number;
    signature: string;
    apiKey: string | undefined;
    cloudName: string | undefined;
    folder: string;
};
export declare const generateSignedDocumentUrl: (publicId: string) => string;
//# sourceMappingURL=uploadService.d.ts.map