import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const PLAYER_PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const PLAYER_PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function uploadPlayerPhotoDataUri(dataUri: string): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'club-albania/players',
    resource_type: 'image',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' },
    ],
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadPlayerPhotoBase64(
  base64: string,
  mimeType: string,
): Promise<{ url: string; publicId: string }> {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const size = Buffer.from(cleaned, 'base64').length;
  if (size > PLAYER_PHOTO_MAX_SIZE_BYTES) {
    throw new Error('File-i është shumë i madh. Madhësia maksimale është 5MB.');
  }
  if (!PLAYER_PHOTO_ALLOWED_TYPES.includes(mimeType as (typeof PLAYER_PHOTO_ALLOWED_TYPES)[number])) {
    throw new Error('Formati i file-it nuk lejohet. Përdorni JPG, PNG, GIF ose WebP.');
  }
  return uploadPlayerPhotoDataUri(`data:${mimeType};base64,${cleaned}`);
}
