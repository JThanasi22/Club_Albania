import { cookies } from 'next/headers';

export async function getAdminSessionFromCookies(): Promise<unknown | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin-session');
  if (!session?.value) return null;
  try {
    return JSON.parse(session.value) as unknown;
  } catch {
    return null;
  }
}
