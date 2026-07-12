import { runHardenedPipeline } from './src/lib/studio-core/compiler-engine.server';
import fs from 'fs';

async function main() {
    const mainTex = `\\documentclass{article}
\\begin{document}
Test Image:
\\begin{figure}[h]
\\zimg{test_img.png}{width=0.5\\linewidth}{fig_1}{test_img.png}
\\end{figure}
\\end{document}`;

    const imgB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    const files = [
        { path: 'main.tex', content: mainTex },
        { path: 'test_img.png', content: `data:image/png;base64,${imgB64}` }
    ];

    console.log("Starting runHardenedPipeline...");
    const result = await runHardenedPipeline('pdflatex', files, 'main.tex', 'test_proj', { profile: 'doc2latex', ghostMode: true });
    
    console.log("Success:", result.success);
    if (result.log) {
        console.log("Log has PI markers?", result.log.includes('@PI@'));
    } else {
        console.log("No log returned.");
    }
    
    if (result.pdfBase64) {
        fs.writeFileSync('test_out.pdf', Buffer.from(result.pdfBase64, 'base64'));
        console.log("Wrote test_out.pdf");
    }
}
main().catch(console.error);
