import { NextResponse } from 'next/server';
import { computeDashboardStats } from '@/lib/computeDashboardStats';

export async function GET() {
  try {
    const payload = await computeDashboardStats();
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Marrja e statistikave dështoi' }, { status: 500 });
  }
}
