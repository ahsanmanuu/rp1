import { inkGhostPdf } from './src/lib/studio-core/compiler-engine.server';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function main() {
    // 1x1 proxy PDF base64
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const pdfBase64 = await pdfDoc.saveAsBase64();

    // Mock log
    const mockLog = `
This is a tectonic log.
@PI@L:fig_1:123456:123456
@PI@R:fig_1:234567:1:EOF@PI
`;

    // Mock fullAssets
    const imgB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const fullAssets = [
        { path: 'main.tex', content: `\\zimg{test_img.png}{}{fig_1}{test_img.png}` },
        { path: 'test_img.png', content: `data:image/png;base64,${imgB64}` }
    ];

    console.log("Starting inkGhostPdf...");
    try {
        const finalPdf = await inkGhostPdf(pdfBase64, mockLog, fullAssets as any);
        console.log("Success! Final PDF length:", finalPdf.length);
    } catch (e) {
        console.error("Failed:", e);
    }
}
main().catch(console.error);
