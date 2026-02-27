import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Create default admin
    const admin = await db.admin.create({
      data: {
        username: 'admin',
        password: 'admin123', // Default password - should be changed
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
