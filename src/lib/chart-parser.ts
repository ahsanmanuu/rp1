import { JSDOM } from "jsdom";
import sharp from "sharp";

async function svgToPngBuffer(svgBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(svgBuffer, { density: 200 }).png({ compressionLevel: 6 }).toBuffer();
  } catch (err: any) {
    console.warn("[CHART_PARSER] sharp failed to convert SVG to PNG, generating blank PNG fallback:", err?.message);
    try {
      return await sharp({
        create: {
          width: 900,
          height: 600,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
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

function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PALETTE = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#d97706', // Amber
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#db2777', // Pink
];

/**
 * Generates an academic publication-grade vector SVG chart locally without external API calls.
 */
function generateHighFidelityChartSvg(
  type: string,
  title: string,
  labels: string[],
  datasets: { label: string; data: number[] }[]
): Buffer {
  const width = 1000;
  const height = 650;
  const margin = { top: 70, right: 50, bottom: 90, left: 80 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  let allVals: number[] = [];
  datasets.forEach(d => { allVals.push(...d.data.filter(v => typeof v === 'number' && !isNaN(v))); });
  if (allVals.length === 0) allVals = [0, 10];

  const minValRaw = Math.min(...allVals);
  const maxValRaw = Math.max(...allVals);
  const minVal = minValRaw < 0 ? minValRaw * 1.1 : 0;
  const maxVal = maxValRaw > 0 ? maxValRaw * 1.15 : (minValRaw === 0 ? 10 : 0);
  const valRange = maxVal - minVal || 1;

  let svgContent = '';

  // Background card
  svgContent += `<rect width="${width}" height="${height}" fill="#ffffff" rx="8" />`;
  svgContent += `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#e2e8f0" stroke-width="2" rx="8" />`;

  // Chart Title
  svgContent += `<text x="${width / 2}" y="42" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>`;

  // Handle Pie Charts
  if (type === 'pie' || type === 'donut') {
    const pieData = datasets[0]?.data || [];
    const total = pieData.reduce((acc, v) => acc + Math.max(0, v), 0) || 1;
    const cx = width / 2;
    const cy = margin.top + plotHeight / 2 - 20;
    const r = Math.min(plotWidth, plotHeight) / 2.3;
    let startAngle = -Math.PI / 2;

    pieData.forEach((val, idx) => {
      const sliceAngle = (Math.max(0, val) / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const color = PALETTE[idx % PALETTE.length];

      const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      svgContent += `<path d="${pathData}" fill="${color}" stroke="#ffffff" stroke-width="2" />`;

      // Percentage label on slice if slice is large enough (> 5%)
      if (sliceAngle > 0.3) {
        const midAngle = startAngle + sliceAngle / 2;
        const textR = r * 0.65;
        const tx = cx + textR * Math.cos(midAngle);
        const ty = cy + textR * Math.sin(midAngle);
        const pct = Math.round((val / total) * 100);
        svgContent += `<text x="${tx}" y="${ty + 4}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#ffffff">${pct}%</text>`;
      }
      startAngle = endAngle;
    });

    // Legend at bottom
    const legendY = height - 45;
    const itemWidth = Math.min(160, width / Math.max(1, labels.length));
    const startLegendX = Math.max(20, (width - (labels.length * itemWidth)) / 2);
    labels.forEach((lbl, li) => {
      const lx = startLegendX + li * itemWidth;
      const color = PALETTE[li % PALETTE.length];
      svgContent += `<rect x="${lx}" y="${legendY}" width="12" height="12" rx="2" fill="${color}" />`;
      svgContent += `<text x="${lx + 18}" y="${legendY + 10}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155">${escapeXml(lbl)}</text>`;
    });

    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${svgContent}\n</svg>`);
  }

  // Coordinate System & Grid for Bar/Line/Scatter Charts
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const yVal = minVal + (valRange / ticks) * i;
    const yPos = margin.top + plotHeight - ((yVal - minVal) / valRange) * plotHeight;
    // Gridline
    svgContent += `<line x1="${margin.left}" y1="${yPos}" x2="${margin.left + plotWidth}" y2="${yPos}" stroke="#f1f5f9" stroke-width="1.5" />`;
    // Y-tick label
    const formattedY = Math.abs(yVal) >= 1000 ? (yVal / 1000).toFixed(1) + 'k' : (Number.isInteger(yVal) ? yVal.toString() : yVal.toFixed(1));
    svgContent += `<text x="${margin.left - 12}" y="${yPos + 4}" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">${formattedY}</text>`;
  }

  // Base X and Y axis lines
  const zeroYPos = margin.top + plotHeight - ((0 - minVal) / valRange) * plotHeight;
  svgContent += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#94a3b8" stroke-width="2" />`;
  svgContent += `<line x1="${margin.left}" y1="${zeroYPos}" x2="${margin.left + plotWidth}" y2="${zeroYPos}" stroke="#94a3b8" stroke-width="2" />`;

  const catCount = Math.max(1, labels.length);
  const catWidth = plotWidth / catCount;

  // Render Bar Charts
  if (type === 'bar') {
    const seriesCount = Math.max(1, datasets.length);
    const groupPadding = catWidth * 0.2;
    const usableWidth = catWidth - groupPadding;
    const barWidth = Math.max(4, usableWidth / seriesCount);

    labels.forEach((lbl, catIdx) => {
      const groupX = margin.left + catIdx * catWidth + groupPadding / 2;
      // Category Label on X-axis
      svgContent += `<text x="${groupX + usableWidth / 2}" y="${margin.top + plotHeight + 25}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155">${escapeXml(lbl)}</text>`;

      datasets.forEach((ds, serIdx) => {
        const val = ds.data[catIdx] ?? 0;
        const color = PALETTE[serIdx % PALETTE.length];
        const barHeight = Math.max(2, (Math.abs(val) / valRange) * plotHeight);
        const barX = groupX + serIdx * barWidth;
        const barY = val >= 0 ? zeroYPos - barHeight : zeroYPos;

        svgContent += `<rect x="${barX}" y="${barY}" width="${Math.max(2, barWidth - 2)}" height="${barHeight}" fill="${color}" rx="2" />`;
      });
    });
  } else {
    // Line, Area, or Scatter Charts
    labels.forEach((lbl, catIdx) => {
      const xPos = margin.left + catIdx * (plotWidth / Math.max(1, catCount - 1));
      svgContent += `<text x="${xPos}" y="${margin.top + plotHeight + 25}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155">${escapeXml(lbl)}</text>`;
    });

    datasets.forEach((ds, serIdx) => {
      const color = PALETTE[serIdx % PALETTE.length];
      const pts: { x: number; y: number }[] = [];

      ds.data.forEach((val, catIdx) => {
        const xPos = margin.left + catIdx * (plotWidth / Math.max(1, catCount - 1));
        const yPos = margin.top + plotHeight - ((val - minVal) / valRange) * plotHeight;
        pts.push({ x: xPos, y: yPos });
      });

      if (pts.length > 0) {
        const pathString = pts.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

        if (type === 'area' || ds.label.toLowerCase().includes('area')) {
          const areaString = `${pathString} L ${pts[pts.length - 1].x} ${zeroYPos} L ${pts[0].x} ${zeroYPos} Z`;
          svgContent += `<path d="${areaString}" fill="${color}" fill-opacity="0.2" />`;
        }

        svgContent += `<path d="${pathString}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;

        // Points
        pts.forEach(p => {
          svgContent += `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#ffffff" stroke="${color}" stroke-width="2.5" />`;
        });
      }
    });
  }

  // Legend at bottom
  const legendY = height - 35;
  const itemWidth = Math.min(180, width / Math.max(1, datasets.length));
  const startLegendX = Math.max(margin.left, (width - (datasets.length * itemWidth)) / 2);
  datasets.forEach((ds, di) => {
    const lx = startLegendX + di * itemWidth;
    const color = PALETTE[di % PALETTE.length];
    svgContent += `<rect x="${lx}" y="${legendY}" width="14" height="14" rx="3" fill="${color}" />`;
    svgContent += `<text x="${lx + 20}" y="${legendY + 11}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#334155">${escapeXml(ds.label)}</text>`;
  });

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${svgContent}\n</svg>`);
}

/**
 * Extracts data from OOXML chart files (word/charts/chartX.xml) and 
 * generates a high-fidelity raster PNG image locally via Sharp.
 */
export async function generateChartImageFromXml(xml: string): Promise<Buffer | null> {
  try {
    const dom = new JSDOM(xml, { contentType: "text/xml" });
    const doc = dom.window.document;

    // 1. Identify Chart Type
    let type = 'bar';
    if (doc.getElementsByTagName("c:lineChart").length > 0) type = 'line';
    else if (doc.getElementsByTagName("c:pieChart").length > 0 || doc.getElementsByTagName("c:pie3DChart").length > 0) type = 'pie';
    else if (doc.getElementsByTagName("c:scatterChart").length > 0) type = 'scatter';
    else if (doc.getElementsByTagName("c:areaChart").length > 0) type = 'area';

    // 2. Get Chart Title
    let title = "Extracted Chart";
    const titleNodes = doc.getElementsByTagName("c:title");
    if (titleNodes.length > 0) {
      const txNodes = titleNodes[0].getElementsByTagName("c:tx");
      if (txNodes.length > 0) {
        title = txNodes[0].textContent?.trim() || title;
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
        if (vNode) seriesName = vNode.textContent?.trim() || seriesName;
      }

      // Categories (X-Axis) - Extract from first series if available
      if (labels.length === 0) {
        const catNode = ser.getElementsByTagName("c:cat")[0];
        if (catNode) {
          const ptNodes = catNode.getElementsByTagName("c:pt");
          for (let j = 0; j < ptNodes.length; j++) {
            const vNode = ptNodes[j].getElementsByTagName("c:v")[0];
            if (vNode) labels.push(vNode.textContent?.trim() || `Cat ${j + 1}`);
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
          if (vNode) {
            const num = parseFloat(vNode.textContent?.trim() || "0");
            data.push(isNaN(num) ? 0 : num);
          }
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
      const maxLen = Math.max(...datasets.map(d => d.data.length));
      labels = Array.from({ length: maxLen }, (_, i) => `Cat ${i + 1}`);
    }

    // 4. Generate SVG & render to PNG via Sharp locally
    const svgBuffer = generateHighFidelityChartSvg(type, title, labels, datasets);
    return await svgToPngBuffer(svgBuffer);
  } catch (err: any) {
    console.error("[CHART_PARSER] Failed to generate chart:", err.message);
    const minimalSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">` +
      `<rect width="600" height="300" fill="#f8fafc" stroke="#e2e8f0" rx="8"/>` +
      `<text x="300" y="150" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" fill="#64748b">Chart data could not be rendered</text>` +
      `</svg>`
    );
    return await svgToPngBuffer(minimalSvg);
  }
}
