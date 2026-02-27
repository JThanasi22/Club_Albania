import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';

// This route creates a default admin user if none exists
export async function POST() {
  try {
    const existingAdmin = await db.admin.findFirst();
    
    if (existingAdmin) {
      return NextResponse.json({ 
        message: 'Admin already exists',
        admin: { username: existingAdmin.username }
      });
    }

    // Hash the default password with salt
    const hashedPassword = await hashPassword('admin123');

    // Create default admin with hashed password
    const admin = await db.admin.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'Administrator',
      },
    });

    return NextResponse.json({ 
      message: 'Default admin created',
      admin: { username: admin.username },
      defaultPassword: 'admin123',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}
