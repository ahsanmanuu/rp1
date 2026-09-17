import { JSDOM } from "jsdom";
import sharp from "sharp";

async function svgToPngBuffer(svgBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(svgBuffer, { density: 150 }).png({ compressionLevel: 7 }).toBuffer();
  } catch (err: any) {
    console.warn("[CHART_PARSER] sharp failed to convert SVG to PNG, generating blank PNG fallback:", err?.message);
    try {
      return await sharp({
        create: {
          width: 800,
          height: 500,
          channels: 4,
          background: { r: 250, g: 250, b: 250, alpha: 1 }
        }
      }).png().toBuffer();
    } catch {
      // 1x1 transparent PNG fallback if sharp create fails
      return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
      ]);
    }
  }
}

/**
 * Extracts data from OOXML chart files (word/charts/chartX.xml) and 
 * generates a high-fidelity image using QuickChart API.
 */
function generateFallbackSvg(title: string, labels: string[], datasets: { label: string; data: number[] }[]): Buffer {
  const w = 800;
  const h = 500;
  const rowH = 24;
  const headerH = 40;
  const colX = 200;
  const dataStartY = 100;

  let rows = `<text x="${w / 2}" y="40" text-anchor="middle" font-size="20" font-weight="bold" fill="#1a1a2e">${escapeXml(title)}</text>`;
  rows += `<text x="20" y="${dataStartY - 10}" font-size="14" font-weight="bold" fill="#333">Label</text>`;
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#2980b9', '#27ae60', '#d35400'];
  datasets.forEach((ds, di) => {
    const c = colors[di % colors.length];
    rows += `<text x="${colX + di * 140}" y="${dataStartY - 10}" font-size="14" font-weight="bold" fill="${c}">${escapeXml(ds.label)}</text>`;
  });

  const maxRows = Math.max(...datasets.map(ds => ds.data.length));
  for (let ri = 0; ri < maxRows; ri++) {
    const y = dataStartY + ri * rowH + 4;
    const label = labels[ri] || `L${ri + 1}`;
    rows += `<text x="20" y="${y}" font-size="13" fill="#555">${escapeXml(label)}</text>`;
    datasets.forEach((ds, di) => {
      const val = ds.data[ri] ?? '-';
      rows += `<text x="${colX + di * 140}" y="${y}" font-size="13" fill="#333">${val}</text>`;
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fafafa" rx="8"/>
  <rect y="60" width="${w}" height="2" fill="#e0e0e0"/>
  ${rows}
  <text x="${w / 2}" y="${h - 15}" text-anchor="middle" font-size="11" fill="#999">Chart data extracted from document (image generation unavailable)</text>
</svg>`;
  return Buffer.from(svg);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function generateChartImageFromXml(xml: string): Promise<Buffer | null> {
  try {
    const dom = new JSDOM(xml, { contentType: "text/xml" });
    const doc = dom.window.document;

    // 1. Identify Chart Type
    let type = 'bar';
    if (doc.getElementsByTagName("c:lineChart").length > 0) type = 'line';
    else if (doc.getElementsByTagName("c:pieChart").length > 0) type = 'pie';
    else if (doc.getElementsByTagName("c:pie3DChart").length > 0) type = 'pie';
    else if (doc.getElementsByTagName("c:scatterChart").length > 0) type = 'scatter';
    else if (doc.getElementsByTagName("c:areaChart").length > 0) type = 'line'; 

    // 2. Get Chart Title
    let title = "Extracted Chart";
    const titleNodes = doc.getElementsByTagName("c:title");
    if (titleNodes.length > 0) {
      const txNodes = titleNodes[0].getElementsByTagName("c:tx");
      if (txNodes.length > 0) {
        title = txNodes[0].textContent || title;
      }
    }

    // 3. Extract Series Data
    const datasets: { label: string; data: number[] }[] = [];
    let labels: string[] = [];
    
    const serNodes = doc.getElementsByTagName("c:ser");
    for (let i = 0; i < serNodes.length; i++) {
      const ser = serNodes[i];
      
      // Series Name
      let seriesName = `Series ${i + 1}`;
      const txNode = ser.getElementsByTagName("c:tx")[0];
      if (txNode) {
        const vNode = txNode.getElementsByTagName("c:v")[0];
        if (vNode) seriesName = vNode.textContent || seriesName;
      }

      // Categories (X-Axis) - Extract from first series only
      if (i === 0) {
        const catNode = ser.getElementsByTagName("c:cat")[0];
        if (catNode) {
          const ptNodes = catNode.getElementsByTagName("c:pt");
          for (let j = 0; j < ptNodes.length; j++) {
            const vNode = ptNodes[j].getElementsByTagName("c:v")[0];
            if (vNode) labels.push(vNode.textContent || `Cat ${j+1}`);
          }
        }
      }

      // Values (Y-Axis)
      const data: number[] = [];
      const valNode = ser.getElementsByTagName("c:val")[0] || ser.getElementsByTagName("c:yVal")[0];
      if (valNode) {
        const ptNodes = valNode.getElementsByTagName("c:pt");
        for (let j = 0; j < ptNodes.length; j++) {
          const vNode = ptNodes[j].getElementsByTagName("c:v")[0];
          if (vNode) data.push(parseFloat(vNode.textContent || "0"));
        }
      }

      if (data.length > 0) {
        datasets.push({ label: seriesName, data });
      }
    }

    if (datasets.length === 0) {
      throw new Error("No valid data series extracted from XML.");
    }
    if (labels.length === 0) {
      labels = datasets[0].data.map((_: any, i: number) => `L${i+1}`);
    }

    // 4. Build Chart.js Configuration
    const chartConfig = {
      type: type,
      data: {
        labels: labels,
        datasets: datasets.map((ds, i) => {
          const color = `hsl(${(i * 137.5) % 360}, 70%, 50%)`;
          return {
            label: ds.label,
            data: ds.data,
            backgroundColor: type === 'pie' ? ds.data.map((_, idx) => `hsl(${(idx * 137.5) % 360}, 70%, 50%)`) : color,
            borderColor: color,
            fill: type === 'line' && doc.getElementsByTagName("c:areaChart").length > 0,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        title: {
          display: true,
          text: title,
          font: { size: 18, weight: 'bold' }
        },
        legend: {
          position: 'bottom',
          labels: { font: { size: 13 }, padding: 16 }
        },
        scales: type !== 'pie' ? {
          x: {
            grid: { display: true, color: '#e2e8f0' },
            ticks: { font: { size: 12 } }
          },
          y: {
            beginAtZero: true,
            grid: { display: true, color: '#e2e8f0' },
            ticks: { font: { size: 12 } }
          }
        } : undefined,
      }
    };

    // 5. Call QuickChart API with a 6-second timeout to prevent hanging on Render
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch('https://quickchart.io/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: '2',
          backgroundColor: 'white',
          width: 1200,
          height: 800,
          devicePixelRatio: 3,
          chart: chartConfig
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`QuickChart API Error: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      // Fall through to SVG fallback
      console.warn("[CHART_PARSER] QuickChart API failed, falling back to SVG placeholder:", fetchErr.message);
    }

    // Fallback: render extracted data as a visible SVG table, then convert to genuine PNG
    const fallbackSvg = generateFallbackSvg(title, labels, datasets);
    return await svgToPngBuffer(fallbackSvg);

  } catch (err: any) {
    console.error("[CHART_PARSER] Failed to generate chart:", err.message);
    // Return a minimal visible fallback PNG
    const minimalSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">` +
      `<rect width="400" height="200" fill="#f8f8f8" rx="8"/>` +
      `<text x="200" y="100" text-anchor="middle" font-size="16" fill="#666">Chart could not be extracted</text>` +
      `</svg>`
    );
    return await svgToPngBuffer(minimalSvg);
  }
}
