import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import PocketBase from 'pocketbase';

const COOKIE_NAME = "admin_session";

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';

export interface AdminPayload {
  adminId: string;
  email: string;
  role: string;
  name?: string;
}

function decodePbAdminToken(token: string): AdminPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.type !== 'auth') return null;
    return {
      adminId: payload.id || '',
      email: payload.email || '',
      role: payload.role || 'superadmin',
      name: payload.name || payload.email || 'Admin',
    };
  } catch {
    return null;
  }
}

export async function pbAdminLogin(email: string, password: string) {
  const pb = new PocketBase(PB_URL);
  await pb.collection('_superusers').authWithPassword(email, password);
  return pb;
}

export async function loginAdmin(email: string, password: string): Promise<{ token: string; admin: AdminPayload } | null> {
  try {
    const pb = await pbAdminLogin(email, password);
    if (!pb.authStore?.isValid || !pb.authStore?.token) return null;

    const record = pb.authStore.record || pb.authStore.model;
    return {
      token: pb.authStore.token,
      admin: {
        adminId: record?.id || 'admin',
        email: record?.email || email,
        role: 'superadmin',
        name: record?.name || 'Admin Root',
      },
    };
  } catch (err: any) {
    console.error('[ADMIN_AUTH] Login failed:', err.message);
    return null;
  }
}

export async function getAdminSessionFromCookies(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodePbAdminToken(token);
}

export async function getAdminSessionFromRequest(req: NextRequest): Promise<AdminPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodePbAdminToken(token);
}

export { COOKIE_NAME };
