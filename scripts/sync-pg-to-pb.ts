import pkg from 'pg';
const { Client } = pkg;
import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config({ path: '.env.local' });

function hashId(oldId: string): string {
  // If it's already 15 chars alphanumeric, just return it
  if (/^[a-z0-9]{15}$/.test(oldId)) return oldId;
  
  // Otherwise, hash it and take the first 15 chars, ensuring valid chars
  // Create an md5 hash
  const hash = crypto.createHash('md5').update(oldId).digest('hex');
  // PocketBase IDs must be 15 chars of lowercase alphanumeric
  // Hex is already lowercase alphanumeric
  return hash.substring(0, 15);
}

async function main() {
  console.log('Connecting to Postgres...');
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await pgClient.connect();

  console.log('Connecting to PocketBase...');
  const pb = new PocketBase('http://127.0.0.1:8090');
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io';
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || 'Sczone@123';
  await pb.admins.authWithPassword(adminEmail, adminPassword);

  console.log('Starting sync...');

  // 1. Sync Users
  const { rows: users } = await pgClient.query('SELECT * FROM "User"');
  console.log(`Found ${users.length} users to sync...`);
  
  // Mapping of old user IDs to new user IDs
  const userMap: Record<string, string> = {};

  for (const user of users) {
    const newId = hashId(user.id);
    userMap[user.id] = newId;

    try {
      // Check if user with this email already exists
      const existing = await pb.collection('users').getList(1, 1, { filter: `email="${user.email}"` });
      
      const payload = {
        name: user.name || '',
        points: user.points || 0,
        theme: user.theme || 'system',
        status: user.status || 'active',
        role: user.role || 'user',
        membership: user.membership || 'free',
        emailVisibility: true,
      };

      if (existing.items.length > 0) {
        // Update existing user created by recent login
        console.log(`Updating existing user ${user.email}...`);
        await pb.collection('users').update(existing.items[0].id, payload);
        userMap[user.id] = existing.items[0].id; // Use the PB ID
      } else {
        // Create new user
        payload.id = newId;
        payload.email = user.email;
        // Generate a random password for migrated users
        payload.password = crypto.randomBytes(8).toString('hex');
        payload.passwordConfirm = payload.password;
        
        await pb.collection('users').create(payload);
      }
    } catch (e: any) {
      console.error(`Error syncing user ${user.email}:`, e.message);
    }
  }

  // 2. Sync Projects
  const { rows: projects } = await pgClient.query('SELECT * FROM "Project"');
  console.log(`Found ${projects.length} projects to sync...`);
  
  for (const project of projects) {
    try {
      const newUserId = userMap[project.userId];
      if (!newUserId) {
        console.log(`Skipping project ${project.id} because user ${project.userId} wasn't migrated`);
        continue;
      }

      const existing = await pb.collection('projects').getList(1, 1, { filter: `originalFilename="${project.originalFilename}" && userId="${newUserId}"` });
      if (existing.items.length > 0) continue;

      await pb.collection('projects').create({
        id: hashId(project.id),
        userId: newUserId,
        title: project.title || 'Untitled',
        originalFilename: project.originalFilename || '',
        templateName: project.templateName || '',
        latexContent: project.latexContent || '',
        bibContent: project.bibContent || '',
        status: project.status || 'draft',
        projectType: project.projectType || 'article',
        wordCount: project.wordCount || 0,
        charCount: project.charCount || 0,
        imageCount: project.imageCount || 0,
        chartCount: project.chartCount || 0,
        tableCount: project.tableCount || 0,
        equationCount: project.equationCount || 0,
        citationCount: project.citationCount || 0,
        referenceCount: project.referenceCount || 0,
        pseudocodeCount: project.pseudocodeCount || 0,
        content: project.content || '',
        structuredContent: project.structuredContent ? JSON.parse(project.structuredContent) : {},
        firstPdfDownloaded: project.firstPdfDownloaded || false,
      });
    } catch (e: any) {
      console.error(`Error syncing project ${project.id}:`, e.message);
    }
  }

  console.log('Sync complete!');
  await pgClient.end();
}

main().catch(console.error);
