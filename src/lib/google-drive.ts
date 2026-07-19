/**
 * Google Drive integration for backup uploads/restore downloads.
 * Uses the Google Drive REST API v3 with a service account or API key.
 *
 * Setup:
 * 1. Create a Google Cloud project
 * 2. Enable Google Drive API
 * 3. Create a service account → download JSON key
 * 4. Share the target Google Drive folder with the service account email
 * 5. Paste the JSON key and folder ID in the admin backup settings
 */

interface GoogleDriveConfig {
  credentials: string;  // Service account JSON string
  folderId: string;     // Target folder ID in Google Drive
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
}

/**
 * Extract access token from service account credentials.
 */
async function getAccessToken(credentialsJson: string): Promise<string> {
  const creds = JSON.parse(credentialsJson);

  if (creds.type === 'service_account') {
    // Service account JWT flow
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Sign JWT using crypto
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsignedJwt = `${headerB64}.${payloadB64}`;

    // Import private key for signing
    const privateKeyPem = creds.private_key;
    const privateKeyDer = pemToDer(privateKeyPem);

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(unsignedJwt)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${unsignedJwt}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      throw new Error(`Google auth failed: ${tokenData.error_description || tokenData.error}`);
    }
    return tokenData.access_token;
  }

  throw new Error('Unsupported credentials format. Use a Google service account JSON key.');
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Upload a file to Google Drive.
 */
export async function uploadToGoogleDrive(
  config: GoogleDriveConfig,
  filename: string,
  fileBuffer: Buffer,
  mimeType: string = 'application/zip'
): Promise<DriveFile> {
  const token = await getAccessToken(config.credentials);

  const metadata = {
    name: filename,
    parents: config.folderId ? [config.folderId] : [],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename);

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Google Drive upload failed: ${resp.status} ${err.error?.message || resp.statusText}`);
  }

  return resp.json();
}

/**
 * List backup files in the Google Drive folder.
 */
export async function listGoogleDriveBackups(
  config: GoogleDriveConfig
): Promise<DriveFile[]> {
  const token = await getAccessToken(config.credentials);

  const query = config.folderId
    ? `'${config.folderId}' in parents and name contains 'latexify-backup' and trashed = false`
    : `name contains 'latexify-backup' and trashed = false`;

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime%20desc&fields=files(id,name,mimeType,size,createdTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Google Drive list failed: ${resp.status} ${err.error?.message || resp.statusText}`);
  }

  const data = await resp.json();
  return data.files || [];
}

/**
 * Download a file from Google Drive.
 */
export async function downloadFromGoogleDrive(
  config: GoogleDriveConfig,
  fileId: string
): Promise<Buffer> {
  const token = await getAccessToken(config.credentials);

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Google Drive download failed: ${resp.status} ${err.error?.message || resp.statusText}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete old backups from Google Drive based on retention policy.
 */
export async function cleanupOldBackups(
  config: GoogleDriveConfig,
  retentionDays: number
): Promise<number> {
  const files = await listGoogleDriveBackups(config);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  let deleted = 0;
  const token = await getAccessToken(config.credentials);

  for (const file of files) {
    if (new Date(file.createdTime) < cutoff) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        deleted++;
      } catch {}
    }
  }

  return deleted;
}

/**
 * Test Google Drive connection with provided credentials.
 */
export async function testGoogleDriveConnection(
  config: GoogleDriveConfig
): Promise<{ success: boolean; error?: string; folderName?: string }> {
  try {
    const token = await getAccessToken(config.credentials);

    if (config.folderId) {
      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${config.folderId}?fields=name,mimeType`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!resp.ok) {
        return { success: false, error: `Folder not found or not shared (HTTP ${resp.status})` };
      }

      const folder = await resp.json();
      return { success: true, folderName: folder.name };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
