import { JSDOM } from 'jsdom';
import AdmZip from 'adm-zip';

/**
 * Extracts Word bibliography sources and converts them to BibTeX format.
 */
export function extractBibliography(zip: AdmZip): string {
  try {
    const sourcesXml = zip.readAsText('word/bibliography/sources.xml');
    if (!sourcesXml) return "";

    const dom = new JSDOM(sourcesXml, { contentType: "text/xml" });
    const sources = dom.window.document.getElementsByTagName('b:Source');
    let bibtex = "";

    const mapType = (type: string) => {
      const types: Record<string, string> = {
        'JournalArticle': 'article',
        'Book': 'book',
        'ConferenceProceedings': 'inproceedings',
        'Report': 'techreport',
        'InternetSite': 'misc'
      };
      return types[type] || 'misc';
    };

    Array.from(sources).forEach(src => {
      const tag = src.getElementsByTagName('b:Tag')[0]?.textContent || `ref_${Math.random().toString(36).substring(7)}`;
      const type = src.getElementsByTagName('b:SourceType')[0]?.textContent || "misc";
      const bibType = mapType(type);
      
      const title = src.getElementsByTagName('b:Title')[0]?.textContent || "";
      const year = src.getElementsByTagName('b:Year')[0]?.textContent || "";
      const journal = src.getElementsByTagName('b:JournalName')[0]?.textContent || "";
      const bookTitle = src.getElementsByTagName('b:ConferenceName')[0]?.textContent || "";
      
      // Authors
      const nameList = src.getElementsByTagName('b:NameList')[0];
      const persons = nameList?.getElementsByTagName('b:Person');
      let authors = "";
      if (persons && persons.length > 0) {
        authors = Array.from(persons).map(p => {
          const last = p.getElementsByTagName('b:Last')[0]?.textContent || "";
          const first = p.getElementsByTagName('b:First')[0]?.textContent || "";
          return last && first ? `${last}, ${first}` : last || first;
        }).join(" and ");
      } else {
        authors = src.getElementsByTagName('b:Corporate')[0]?.textContent || "";
      }

      bibtex += `@${bibType}{${tag},\n`;
      if (authors) bibtex += `  author = {${authors}},\n`;
      if (title) bibtex += `  title = {${title}},\n`;
      if (year) bibtex += `  year = {${year}},\n`;
      if (journal && bibType === 'article') bibtex += `  journal = {${journal}},\n`;
      if (bookTitle && bibType === 'inproceedings') bibtex += `  booktitle = {${bookTitle}},\n`;
      bibtex += `}\n\n`;
    });

    return bibtex;
  } catch (e) {
    console.error("Bib extraction failed:", e);
    return "";
  }
}

/**
 * Extracts algorithms and pseudocode based on paragraph styles.
 */
export function extractAlgorithms(documentXml: string): string[] {
  const dom = new JSDOM(documentXml, { contentType: "text/xml" });
  const paragraphs = dom.window.document.getElementsByTagName('w:p');
  const algos: string[] = [];
  
  let currentAlgo: string[] = [];
  
  Array.from(paragraphs).forEach(p => {
    const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val');
    const text = p.textContent || "";
    
    if (style?.toLowerCase().includes('algorithm') || style?.toLowerCase().includes('code')) {
      currentAlgo.push(text);
    } else if (currentAlgo.length > 0) {
      algos.push(currentAlgo.join('\n'));
      currentAlgo = [];
    }
  });
  
  if (currentAlgo.length > 0) algos.push(currentAlgo.join('\n'));
  return algos;
}

/**
 * Advanced table extraction to handle merged cells.
 */
export function extractTables(documentXml: string): string[] {
  const dom = new JSDOM(documentXml, { contentType: "text/xml" });
  const tables = dom.window.document.getElementsByTagName('w:tbl');
  const latexTables: string[] = [];

  Array.from(tables).forEach(tbl => {
    const rows = tbl.getElementsByTagName('w:tr');
    let tableLatex = "\\begin{table}[h]\n\\centering\n\\begin{tabular}{|" + "l|".repeat(10) + "}\n\\hline\n";
    
    Array.from(rows).forEach(row => {
      const cells = row.getElementsByTagName('w:tc');
      const cellTexts: string[] = [];
      
      Array.from(cells).forEach(cell => {
        // Basic check for merges (simplified for now, but expandable)
        const vMerge = cell.getElementsByTagName('w:vMerge')[0];
        if (vMerge && vMerge.getAttribute('w:val') === 'continue') return;
        
        cellTexts.push(cell.textContent || "");
      });
      
      tableLatex += cellTexts.join(" & ") + " \\\\\\hline\n";
    });
    
    tableLatex += "\\end{tabular}\n\\end{table}\n";
    latexTables.push(tableLatex);
  });

  return latexTables;
}
