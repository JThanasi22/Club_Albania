import { NextResponse } from 'next/server';
import {
  PLAYER_PHOTO_ALLOWED_TYPES,
  PLAYER_PHOTO_MAX_SIZE_BYTES,
  uploadPlayerPhotoDataUri,
} from '@/lib/uploadPlayerPhoto';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nuk u gjet asnjë file' }, { status: 400 });
    }

    if (!PLAYER_PHOTO_ALLOWED_TYPES.includes(file.type as (typeof PLAYER_PHOTO_ALLOWED_TYPES)[number])) {
      return NextResponse.json({ error: 'Formati i file-it nuk lejohet. Përdorni JPG, PNG, GIF ose WebP.' }, { status: 400 });
    }

    if (file.size > PLAYER_PHOTO_MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File-i është shumë i madh. Madhësia maksimale është 5MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;
    const result = await uploadPlayerPhotoDataUri(dataUri);

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return NextResponse.json({ error: 'Ngarkimi i fotos dështoi' }, { status: 500 });
  }
}
