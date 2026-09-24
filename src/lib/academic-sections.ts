/**
 * Shared canonical academic section definitions and detection utilities.
 * Synchronizes heading classification across deep-parser, LatexAssembler, and ModularLatexAssembler.
 */

export const FORCED_LEVEL1_SECTIONS = new Set<string>([
  // Core IMRAD & Universal Sections
  'abstract',
  'introduction',
  'background',
  'background and motivation',
  'motivation',
  'related work',
  'related works',
  'literature review',
  'literature',
  'existing literature',
  'literature survey',
  'literature review/survey',
  'survey',
  'literature review and survey',
  'review of literature',
  'review of related literature',
  'state of the art',
  'research gap',
  'research gaps',

  // Theory & Methodology
  'methodology',
  'methods',
  'materials and methods',
  'research methodology',
  'research design',
  'research questions',
  'theoretical framework',
  'conceptual framework',
  'proposed method',
  'proposed approach',
  'proposed framework',
  'proposed methodology',
  'proposed system',
  'proposed model',
  'proposed architecture',
  'experimental framework and findings',

  // System & Architecture
  'system architecture',
  'system model',
  'system design',
  'system overview',
  'problem formulation',
  'problem statement',
  'mathematical formulation',
  'implementation',
  'implementation details',

  // Case Studies & Analysis
  'case study',
  'case studies',
  'analysis',
  'data analysis',
  'statistical analysis',

  // Experiments & Evaluation
  'experiments',
  'experimental setup',
  'experimental results',
  'results',
  'discussion',
  'results and discussion',
  'evaluation',
  'performance evaluation',
  'simulation results',
  'simulation',
  'simulations',
  'comparative analysis',
  'comparison',
  'findings',
  'key findings',

  // Conclusion & Future Work
  'conclusion',
  'conclusions',
  'conclusions and future scope',
  'conclusions and future work',
  'conclusions and future works',
  'conclusion and future work',
  'conclusion and future scope',
  'conclusion and future works',
  'conclusion and recommendations',
  'summary and conclusion',
  'concluding remarks',
  'future work',
  'future works',
  'future scope',
  'future directions',
  'recommendations',
  'implications',
  'practical implications',
  'theoretical implications',
  'summary',

  // Domain-specific major sections
  'anomaly detection',
  'logic failure anomaly detection',
  'pretrained models and transfer learning',
  'pretrained model and transfer learning',
  'transfer learning and pretrained models',

  // Back-matter, Declarations & Ethics
  'acknowledgements',
  'acknowledgments',
  'acknowledgement',
  'acknowledgment',
  'references',
  'bibliography',
  'appendix',
  'appendices',
  'statements and declarations',
  'declarations and statements',
  'declarations',
  'ethics approval',
  'ethical approval',
  'ethics statement',
  'conflict of interest',
  'conflicts of interest',
  'competing interests',
  'funding',
  'funding statement',
  'funding information',
  'data availability',
  'data availability statement',
  'availability of data',
  'authors contributions',
  'author contributions',
  'contributors',
  'supplementary material',
  'supplementary materials',
  'supplementary information',
  'limitations',
  'study limitations',
  'scope and limitations',
  'scope of study',
  'scope of the study',
  'abbreviations',
  'consent to participate',
  'consent for publication',
  'informed consent'
]);

/**
 * Normalizes a heading title by stripping numeric/alphabetic/roman prefixes and punctuation.
 */
export function normalizeHeadingTitle(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/^(?:section|subsection|subsubsection)?\s*(?:\d+[.\s]+|[ivxlcdm]+[.\s]+|[a-z][.\s]+)+/i, '')
    .replace(/[:.\s]*$/, '')
    .trim();
}

/**
 * Checks if a heading title corresponds to a canonical Level-1 section in academic manuscripts.
 */
export function isCanonicalL1Heading(rawOrNormalizedText: string): boolean {
  if (!rawOrNormalizedText) return false;
  const norm = normalizeHeadingTitle(rawOrNormalizedText);
  if (!norm) return false;

  if (FORCED_LEVEL1_SECTIONS.has(norm)) {
    return true;
  }

  // Regex prefix check for common composite titles (e.g. "Conclusion and Perspectives", "Future Work - Next Steps")
  if (/^(?:conclusion|conclusions|concluding|future work|future scope|future direction|literature review|literature survey|related works?|system model|system architecture|materials and methods|results and discussion|performance evaluation|declarations|acknowledg|data availability|theoretical framework|conceptual framework|research design|research methodology|case stud|comparative analysis)\b/i.test(norm)) {
    return true;
  }

  // Prefix matching against canonical items (e.g. "Methodology: Experimental Setup")
  for (const canon of FORCED_LEVEL1_SECTIONS) {
    if (norm.startsWith(canon + ' ') || norm.startsWith(canon + ':') || norm.startsWith(canon + ' -') || norm.startsWith(canon + '–')) {
      return true;
    }
  }

  return false;
}
