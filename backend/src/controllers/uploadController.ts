import { Request, Response } from 'express';
import { generateUploadSignature, generateSignedDocumentUrl } from '../services/uploadService';

export const getUploadSignature = (req: Request, res: Response) => {
  try {
    const signatureData = generateUploadSignature();
    res.status(200).json({ status: 'success', data: signatureData });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate upload signature.' });
  }
};

export const getSignedDocumentUrl = (req: Request, res: Response) => {
  try {
    const { publicId } = req.query;
    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({ error: 'publicId is required.' });
    }
    const url = generateSignedDocumentUrl(publicId);
    res.status(200).json({ status: 'success', data: { url } });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate signed URL.' });
  }
};
