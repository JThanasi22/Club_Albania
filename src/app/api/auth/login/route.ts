import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyPassword } from '@/lib/password';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Përdoruesi dhe fjalëkalimi janë të detyrueshëm' }, { status: 400 });
    }

    // Find admin user
    const admin = await db.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Kredencialet janë të gabuara' }, { status: 401 });
    }

    // Verify password with bcrypt
    const isValid = await verifyPassword(password, admin.password);

    if (!isValid) {
      return NextResponse.json({ error: 'Kredencialet janë të gabuara' }, { status: 401 });
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('admin-session', JSON.stringify({
      id: admin.id,
      username: admin.username,
      name: admin.name,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Hyrja dështoi' }, { status: 500 });
  }
}
