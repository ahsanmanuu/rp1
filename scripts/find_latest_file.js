import fs from 'fs';
import path from 'path';

const baseDir = 'public/uploads/projects';

function findLatestMainTex() {
  try {
    const dirs = fs.readdirSync(baseDir);
    let latestTime = 0;
    let latestFile = '';

    for (const dir of dirs) {
      const fullDir = path.join(baseDir, dir);
      if (!fs.statSync(fullDir).isDirectory()) continue;

      const mainTexPath = path.join(fullDir, 'main.tex');
      if (fs.existsSync(mainTexPath)) {
        const stat = fs.statSync(mainTexPath);
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs;
          latestFile = mainTexPath;
        }
      }
    }

    if (!latestFile) {
      console.log("No main.tex found in subdirectories.");
      return;
    }

    console.log(`[FOUND FILE] ${latestFile} | Modified: ${new Date(latestTime)}`);
    const content = fs.readFileSync(latestFile, 'utf-8');
    const lines = content.split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    const start = Math.max(0, 145);
    const end = Math.min(lines.length, 180);
    
    for (let i = start; i < end; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  } catch (err) {
    console.error("Error searching for files:", err);
  }
}

findLatestMainTex();
