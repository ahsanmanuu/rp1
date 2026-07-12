
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cf02921d-fcb9-4479-88a7-55d510798f54';
const YTOTECH_URL = 'https://latex.ytotech.com/builds/sync';

async function diagnose() {
  console.log(`[DIAGNOSTIC] Analyzing Project: ${PROJECT_ID}`);
  
  const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', PROJECT_ID);
  if (!fs.existsSync(projectDir)) {
    console.error("Project directory not found!");
    return;
  }

  const files = fs.readdirSync(projectDir);
  console.log(`[FILES] Found ${files.length} files:`, files);

  const resources = files.map(f => {
    const fp = path.join(projectDir, f);
    const content = fs.readFileSync(fp);
    return {
      path: f,
      file: content.toString('base64'),
      main: f === 'main.tex'
    };
  });

  console.log("[CLOUD] Sending to YtoTech...");
  try {
    const res = await fetch(YTOTECH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compiler: 'pdflatex', resources })
    });
    
    const text = await res.text();
    console.log("[RESULT] Status:", res.status);
    if (!res.ok) {
       console.log("[ERROR_LOG] Full Output:", text);
    } else {
       console.log("[SUCCESS] Received PDF. Size:", text.length);
    }
  } catch (e) {
    console.error("[FETCH_FAIL]", e);
  }
}

diagnose();
