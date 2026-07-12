import { DeepDocumentParser } from './deep-parser';
import { LatexAssembler } from './assembler';

export function transformHtmlToLatex(html: string, templateId: string): { latex: string; files: Record<string, string>; stats: any } {
  if (!html) return { latex: "", files: {}, stats: { words: 0, chars: 0, images: 0, tables: 0, equations: 0, sections: 0 } };
  
  // 1000% FIDELITY: Use the modern Precision Pipeline instead of legacy processing
  // This ensures that 'The Extraction Law' and 'Universal Assembler' are applied
  // even in the direct conversion route.
  const doc = DeepDocumentParser.parse(html, [], "Converted Document");
  const { mainTex, files } = LatexAssembler.assemble(doc, templateId);

  return { 
    latex: mainTex,
    files,
    stats: { 
      words: doc.stats.wordCount, 
      chars: doc.stats.charCount, 
      images: doc.stats.imageCount, 
      tables: doc.stats.tableCount, 
      equations: doc.stats.equationCount, 
      sections: doc.body.filter(n => n.type === 'heading').length,
      pseudocode: doc.stats.pseudocodeCount,
      citations: doc.stats.citationCount
    } 
  };
}
