import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';

// This route migrates plain text passwords to hashed passwords
// Should be called once after deploying the password encryption feature
export async function POST(request: Request) {
  try {
    // Check for secret key to prevent unauthorized access
    const body = await request.json().catch(() => ({}));
    const { secret } = body;
    
    // Simple protection - in production use a proper API key
    if (secret !== 'club-albania-migrate-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admins = await db.admin.findMany();
    const results: { username: string; status: string }[] = [];

    for (const admin of admins) {
      // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      const isAlreadyHashed = admin.password.startsWith('$2');
      
      if (isAlreadyHashed) {
        results.push({ username: admin.username, status: 'already_hashed' });
        continue;
      }

      // Password is plain text, hash it
      const hashedPassword = await hashPassword(admin.password);
      
      await db.admin.update({
        where: { id: admin.id },
        data: { password: hashedPassword },
      });
      
      results.push({ username: admin.username, status: 'migrated' });
    }

    return NextResponse.json({ 
      message: 'Password migration complete',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
