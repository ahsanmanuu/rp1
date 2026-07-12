import { PrismaClient } from '@prisma/client';
import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const prisma = new PrismaClient();
  const pb = new PocketBase('http://127.0.0.1:8090');
  
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io';
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || 'Sczone@123';
  await pb.admins.authWithPassword(adminEmail, adminPassword);

  console.log('Starting sync...');

  // Sync Users
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users to sync...`);
  for (const user of users) {
    try {
      await pb.collection('users').create({
        id: user.id,
        email: user.email,
        name: user.name || '',
        points: user.points,
        theme: user.theme,
        status: user.status,
        role: user.role,
        membership: user.membership,
        // Convert nulls to undefined or handle date parsing if needed
      });
    } catch (e: any) {
      // Ignore if already exists
      if (e?.response?.code !== 400) console.error(`Error syncing user ${user.id}:`, e.message);
    }
  }

  // Sync Projects
  const projects = await prisma.project.findMany();
  console.log(`Found ${projects.length} projects to sync...`);
  for (const project of projects) {
    try {
      await pb.collection('projects').create({
        id: project.id,
        userId: project.userId,
        title: project.title,
        originalFilename: project.originalFilename || '',
        templateName: project.templateName || '',
        latexContent: project.latexContent || '',
        bibContent: project.bibContent || '',
        status: project.status,
        projectType: project.projectType,
        wordCount: project.wordCount,
        charCount: project.charCount,
        imageCount: project.imageCount,
        chartCount: project.chartCount,
        tableCount: project.tableCount,
        equationCount: project.equationCount,
        citationCount: project.citationCount,
        referenceCount: project.referenceCount,
        pseudocodeCount: project.pseudocodeCount,
        content: project.content || '',
        structuredContent: JSON.parse(project.structuredContent || '{}'),
        firstPdfDownloaded: project.firstPdfDownloaded,
      });
    } catch (e: any) {
      if (e?.response?.code !== 400) console.error(`Error syncing project ${project.id}:`, e.message);
    }
  }

  console.log('Sync complete!');
}

main().catch(console.error);
