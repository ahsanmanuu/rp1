import { pbAdmin } from './pb';
import fs from 'fs';
import path from 'path';

export async function getLogoBase64(): Promise<string> {
  try {
    const pb = await pbAdmin();
    const records = await pb.collection('site_settings').getFullList({ filter: 'key="site_logo"', limit: 1 });
    if (records.length > 0) {
      const logoUrl = (records[0] as any).value?.logoUrl;
      if (logoUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(logoUrl, { signal: controller.signal });
          if (res.ok) {
            const buf = await res.arrayBuffer();
            return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }
  } catch (e) {
    console.error('[getLogoBase64] PB fetch failed, falling back to filesystem:', e);
  }
  return getLogoBase64FromFs();
}

let cachedLogoUrl: string | null = null;

export async function getLogoUrlFromPb(): Promise<string> {
  if (cachedLogoUrl) return cachedLogoUrl;
  try {
    const pb = await pbAdmin();
    const records = await pb.collection('site_settings').getFullList({ filter: 'key="site_logo"', limit: 1 });
    if (records.length > 0) {
      const logoUrl = (records[0] as any).value?.logoUrl;
      if (logoUrl) { cachedLogoUrl = logoUrl; return logoUrl; }
    }
  } catch {}
  cachedLogoUrl = '/logo.png';
  return cachedLogoUrl;
}

function getLogoBase64FromFs(): string {
  const candidates = [
    path.join(process.cwd(), 'public', 'logo.png'),
    path.resolve('./public/logo.png'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'logo.png'),
  ];
  for (const logoPath of candidates) {
    try {
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch (e: any) {
      console.error(`[getLogoBase64] Error reading ${logoPath}:`, e.message);
    }
  }
  return '';
}
