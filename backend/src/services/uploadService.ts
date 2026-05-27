import cloudinary from '../utils/cloudinary';

export const generateUploadSignature = () => {
  const timestamp = Math.round((new Date).getTime() / 1000);
  const paramsToSign = {
    timestamp,
    folder: 'pgos_uploads'
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign, 
    process.env.CLOUDINARY_API_SECRET as string
  );

  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: 'pgos_uploads'
  };
};

export const generateSignedDocumentUrl = (publicId: string) => {
  // Generates a short-lived URL for private KYC docs
  return cloudinary.utils.private_download_url(
    publicId,
    'jpg',
    { expires_at: Math.floor(Date.now() / 1000) + 900 } // 15 mins expiry
  );
};
