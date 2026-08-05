
import { JOURNAL_DB, Journal } from "./journal-db";
import type { StructuredDocument } from "./deep-parser";

export function chunkText(text: string, maxChars: number = 80000): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + "\n\n[Content Truncated due to length limits...]";
}

/**
 * Builds a structured document digest from a StructuredDocument.
 * This replaces the raw text truncation approach with a compact,
 * fully-labeled representation of the entire document.
 */
export function buildDocumentDigest(structured: StructuredDocument, filename: string): string {
  const parts: string[] = [];
  const SEP = "═".repeat(56);

  parts.push(`MANUSCRIPT: "${filename}"`);

  // ── METADATA ──────────────────────────────────────────────
  parts.push(`\n${SEP}\nMETADATA (ground truth — extracted from document)\n${SEP}`);
  parts.push(`TITLE: ${structured.title || "(not found)"}`);
  const authorNames = (structured.authors || []).map(a => a.name).filter(Boolean);
  parts.push(`AUTHORS: ${authorNames.join("; ") || "(not found)"}`);
  const affilStr = (structured.organizations && structured.organizations.length > 0)
    ? structured.organizations.slice(0, 8).join(" | ")
    : (structured.authors || []).map(a => a.affiliation).filter(Boolean).join(" | ");
  parts.push(`AFFILIATIONS: ${affilStr || "(not found)"}`);
  parts.push(`ABSTRACT:\n${structured.abstract || "(not found)"}`);
  parts.push(`KEYWORDS: ${(structured.keywords || []).join(", ") || "(not found)"}`);

  // ── INVENTORY ─────────────────────────────────────────────
  const s = structured.stats;
  parts.push(`\n${SEP}\nDOCUMENT INVENTORY\n${SEP}`);
  parts.push([
    `• Words: ${s.wordCount.toLocaleString()}`,
    `• Figures/Images: ${s.imageCount}`,
    `• Tables: ${s.tableCount}`,
    `• Equations: ${s.equationCount}`,
    `• Algorithms/Pseudocode: ${s.pseudocodeCount}`,
    `• In-text Citations: ${s.citationCount}`,
    `• Reference Entries: ${s.referenceCount}`,
  ].join("\n"));

  // ── STRUCTURAL OUTLINE ────────────────────────────────────
  const headings = structured.body.filter(n => n.type === "heading");
  if (headings.length > 0) {
    parts.push(`\n${SEP}\nSTRUCTURAL OUTLINE\n${SEP}`);
    parts.push(headings.map(h => {
      const indent = "  ".repeat(Math.max(0, (h.level || 1) - 1));
      return `${indent}${h.text}`;
    }).join("\n"));
  }

  // ── ELEMENT REGISTRY ──────────────────────────────────────
  parts.push(`\n${SEP}\nELEMENT REGISTRY\n${SEP}`);

  const figures = structured.body.filter(n => n.type === "figure");
  if (figures.length > 0) {
    parts.push(`FIGURES (${figures.length} total):`);
    figures.forEach((f, i) => parts.push(`  Fig. ${i + 1}: ${f.caption || "(no caption)"}`));
  }

  const tables = structured.body.filter(n => n.type === "table");
  if (tables.length > 0) {
    parts.push(`TABLES (${tables.length} total):`);
    tables.forEach((t, i) => parts.push(`  Table ${i + 1}: ${t.caption || "(no caption)"}`));
  }

  const algos = structured.body.filter(n => n.type === "algorithm");
  if (algos.length > 0) {
    parts.push(`ALGORITHMS (${algos.length} total):`);
    algos.forEach((a, i) => parts.push(`  Algorithm ${i + 1}: ${a.title || "(unnamed)"}`));
  }

  const equations = structured.body.filter(n => n.type === "equation");
  if (equations.length > 0) {
    parts.push(`EQUATIONS (${equations.length} parsed):`);
    equations.slice(0, 10).forEach((eq, i) => parts.push(`  Eq. ${i + 1}: ${(eq.latex || eq.text || "").substring(0, 120)}`));
  }

  // ── FULL STRUCTURED BODY ──────────────────────────────────
  parts.push(`\n${SEP}\nFULL STRUCTURED CONTENT\n${SEP}`);
  structured.body.forEach(node => {
    switch (node.type) {
      case "heading":
        parts.push(node.level === 1 ? `\n[SECTION] ${node.text}` : `[SUBSECTION-${node.level}] ${node.text}`);
        break;
      case "paragraph":
        if (node.text) parts.push(node.text);
        break;
      case "table":
        parts.push(`[TABLE] ${node.caption || "Table"}`);
        break;
      case "figure":
        parts.push(`[FIGURE] ${node.caption || "Figure"} (id: ${node.id || "—"})`);
        break;
      case "equation":
        parts.push(`[EQUATION] ${node.latex || node.text || ""}`);
        break;
      case "algorithm":
        parts.push(`[ALGORITHM] ${node.title || "Algorithm"}`);
        if (node.items && node.items.length > 0) {
          parts.push(node.items.slice(0, 20).join("\n"));
        }
        break;
      case "list":
        if (node.items) parts.push(node.items.map(item => `• ${item}`).join("\n"));
        break;
    }
  });

  // ── REFERENCES ────────────────────────────────────────────
  if (structured.references.length > 0) {
    parts.push(`\n${SEP}\nREFERENCE LIST (${structured.references.length} entries)\n${SEP}`);
    structured.references.forEach((ref, i) => parts.push(`[${i + 1}] ${ref}`));
  }

  return parts.join("\n");
}

export function buildReviewPrompt(
  text: string,
  filename: string,
  structured?: StructuredDocument | null
): string {
  const content = structured
    ? buildDocumentDigest(structured, filename)
    : chunkText(text, 40000);

  const mode = structured ? "STRUCTURED DIGEST" : "RAW TEXT (truncated)";

  const availableJournalsText = JOURNAL_DB.map((j) => 
    `- "${j.name}" (Publisher: ${j.publisher}, Quartile: ${j.quartile}, Impact Factor: ${j.impactFactor}, Domains: [${j.domains.join(", ")}], Min Entry Threshold Score: ${j.minRecommendedScore}, Scope: ${j.scopeText})`
  ).join("\n");

  return `You are a Senior Editor and Distinguished Reviewer for a top-tier global academic publisher (Nature Portfolio, Elsevier, or IEEE).

You are reviewing ONLY the manuscript whose content is provided below as a ${mode}.
Every insight, title, author, affiliation, abstract, score, and statistic you return MUST be grounded in the MANUSCRIPT CONTENT provided.
Do NOT use prior knowledge about any other paper. Do NOT hallucinate citations, figures, tables, or equations not present.

MANUSCRIPT FILENAME: "${filename}"

MANUSCRIPT METADATA EXTRACTION RULES (STRICT & ACCURATE):
1. TITLE ("extractedTitle"):
   - Extract the EXACT main scientific title of the article.
   - If a line starting with "TITLE:" is present in the preamble or metadata header below, use that exact title string as ground truth.
   - Do NOT pick up journal headers/banners (e.g., "IEEE Transactions on...", "ACM Transactions", "Springer Nature", "Elsevier"), running heads, volume/issue numbers, arXiv IDs (e.g., "arXiv:2301.12345v1"), page numbers, or file names as the title.
   - Clean out any surrounding quotes, line breaks, or footnote markers.

2. AUTHORS ("authors" array & "extractedAuthors" array):
   - Extract ALL author names as a clean JSON array of strings: ["Firstname Lastname", "Author Two"].
   - If a line starting with "AUTHORS:" is present in the preamble or metadata header below, parse clean individual author names from it.
   - Strip academic/professional designations (Dr., Prof., Professor, PhD, Dean, Scholar, Fellow, Lecturer, Assistant Professor, etc.).
   - Strip email addresses, ORCID numbers, corresponding author markers (*, †, ‡), and superscript affiliation numbers (e.g. 1, 2, a, b).
   - Do NOT place department or university names into the authors array.

3. AFFILIATIONS ("affiliations" & "extractedAffiliations" string):
   - Extract the full institutional affiliations of the authors as a consolidated string (e.g., "Department of Computer Science, Stanford University, CA, USA; Department of AI, MIT, Cambridge, MA, USA").
   - If a line starting with "AFFILIATIONS:" is present in the preamble or metadata header below, use that as ground truth.
   - Include department/school, university/institute/company, city, state/province, and country where present.
   - Do NOT include author names, email addresses, phone numbers, or publication citations in the affiliation string.

ANTI-HALLUCINATION RULES:
1. "extractedTitle" MUST be the EXACT main scientific paper title from this manuscript — not from your training data.
2. "authors" MUST be the actual author names from this manuscript.
3. "affiliations" MUST be the actual institutional affiliations from this manuscript.
4. "extractedAbstract" MUST be the EXACT abstract text from this manuscript.
5. All scores must reflect the ACTUAL quality of this manuscript's content.
6. Do NOT invent citations, figures, tables, or equations not mentioned in the text.
7. Journal recommendations must match the ACTUAL domain and scope of this paper.
8. documentStats counts MUST match the DOCUMENT INVENTORY provided above (if using structured mode).

MANUSCRIPT CONTENT:
${content}

JOURNAL SELECTION CRITERIA:
1. You MUST recommend exactly 3 to 5 journals.
2. Select them primarily from the LIST OF DATABASE JOURNALS below. Pick those that match the scientific domain, abstract keywords, and methodology of the manuscript.
3. Align the recommendations with the manuscript's overall score:
   - If overallScore is high (e.g. 80+), recommend high-impact Q1 journals.
   - If overallScore is moderate (e.g. 60-79), recommend journals with corresponding minimum entry threshold scores.
4. For each recommended journal, provide the exact name, publisher, impactFactor, quartile, and an aimScopeMatchScore (0-100).
5. You MUST write a detailed "reasoning" for each recommendation explaining the specific alignment with the manuscript's methodology, abstract, or domain context.

LIST OF DATABASE JOURNALS:
${availableJournalsText}

Respond ONLY with valid JSON (no markdown fences) with these exact keys:
{
  "manuscriptMetadata": {
    "extractedTitle": "exact title from this manuscript",
    "authors": ["Author Name 1", "Author Name 2"],
    "extractedAuthors": ["Author Name 1", "Author Name 2"],
    "affiliations": "Department of CS, Stanford University, CA, USA",
    "extractedAffiliations": "Department of CS, Stanford University, CA, USA",
    "extractedAbstract": "exact abstract from this manuscript",
    "keywords": ["keyword1", "keyword2"]
  },
  "documentStats": {
    "wordCount": 0,
    "charCount": 0,
    "figureCount": 0,
    "tableCount": 0,
    "equationCount": 0,
    "algorithmCount": 0,
    "citationCount": 0,
    "referenceCount": 0
  },
  "overallScore": 88,
  "verdict": "Minor Revision",
  "summary": "The paper presents a CNN architecture for ocular disease multiclass classification.",
  "scores": {
    "originality": 88,
    "methodology": 82,
    "structure": 75,
    "literature": 95,
    "titleAbstract": 85,
    "introduction": 80,
    "results": 78,
    "discussion": 72,
    "conclusion": 88,
    "language": 90
  },
  "detailedReport": {
    "abstract": "The abstract is informative and covers problem, method, results, and implications.",
    "introduction": "The introduction provides sufficient background.",
    "methods": "Methodology describes data collection, preprocessing, and model architecture.",
    "results": "Results present performance metrics and comparisons.",
    "discussion": "Discussion interprets results and addresses clinical relevance.",
    "conclusion": "Conclusion summarizes findings and future directions.",
    "dataConsistency": "The numeric data reported was cross-verified across sections.",
    "citationAlignment": "The references cited in text correspond cleanly with the bibliography section.",
    "claimVerification": "Experimental accuracy claims align with reported data.",
    "codeAvailability": "Code repository availability noted.",
    "scopeFit": "Matches journals focusing on target subject domain.",
    "anonymityStyle": "Meets blind review guidelines.",
    "illustrationQuality": "Figures and tables are legible.",
    "formattingRules": "Conforms with standard manuscript structure."
  },
  "strengths": ["Clear presentation of architecture.", "Good dataset evaluation."],
  "weaknesses": ["Lack of ablation studies.", "Minor grammatical refinements needed."],
  "improvementActions": [{ "section": "Methodology", "advice": "Conduct an ablation study." }],
  "suggestedDomains": ["Computer Science", "Artificial Intelligence", "Computer Vision"],
  "recommendedJournals": [
    {
      "name": "IEEE Transactions on Pattern Analysis and Machine Intelligence",
      "publisher": "IEEE",
      "impactFactor": 23.6,
      "quartile": "Q1",
      "avgWeeksToFirstDecision": 12,
      "avgWeeksToPublication": 24,
      "totalExpectedWeeks": 36,
      "aimScopeMatchScore": 95,
      "reasoning": "Strong match for computer vision based classification.",
      "homeUrl": "https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34",
      "latexTemplateUrl": "https://template-selector.ieee.org/"
    }
  ]
}

CRITICAL: Return ONLY raw JSON. No markdown fences, no explanations, no text before or after the JSON object. Escape newlines in strings. Every value must come from the actual manuscript. Ensure suggestedDomains has at least one of these exact domains: "Computer Science", "Artificial Intelligence", "Computer Vision", "Multidisciplinary", "Science", "Biology", "Chemistry", "Medicine", "Public Health" to trigger the database recommender correctly. Do NOT return 0 or empty fields if you can make a calculated estimate.`;
}

export function buildExtractionPrompt(
  text: string,
  filename: string,
  structured?: StructuredDocument | null
): string {
  if (structured && structured.title && structured.title !== filename) {
    // Already have structured data — ask AI to verify/augment with strict parsing rules
    const authNames = (structured.authors || []).map(a => a.name).filter(Boolean);
    const orgs = (structured.organizations && structured.organizations.length > 0)
      ? structured.organizations.join('; ')
      : (structured.authors || []).map(a => a.affiliation).filter(Boolean).join('; ');

    return `You are a highly accurate academic document metadata parser. The document has already been structurally parsed.
Verify and supplement the pre-extracted metadata from "${filename}".

PRE-EXTRACTED DATA:
Title: ${structured.title}
Authors: ${authNames.join(", ")}
Affiliations: ${orgs}
Abstract: ${structured.abstract?.substring(0, 500)}
Keywords: ${(structured.keywords || []).join(", ")}
Stats: ${JSON.stringify(structured.stats)}

MANUSCRIPT CONTENT (first 10000 chars):
${chunkText(text, 10000)}

EXTRACTION GUIDELINES:
1. "title": Preserve the exact scientific article title. Do NOT replace with journal headers, conference names, or file names.
2. "authors": Clean array of author names. Do NOT include designations (Dr., Prof.), emails, or affiliation numbers.
3. "affiliations": Clean string of author institutions/universities/departments.
4. "abstract": Verbatim abstract text.

Respond ONLY with valid JSON:
{
  "title": "${structured.title}",
  "abstract": "verified abstract",
  "keywords": ${JSON.stringify(structured.keywords)},
  "authors": ${JSON.stringify(authNames)},
  "affiliations": "${orgs}",
  "stats": ${JSON.stringify(structured.stats)}
}`;
  }

  return `You are a highly accurate academic document parser. Your ONLY task is to extract factual metadata that EXPLICITLY EXISTS in the provided manuscript text. Do NOT invent, hallucinate, or use prior knowledge.

MANUSCRIPT FILENAME: "${filename}"

CRITICAL EXTRACTION RULES:
1. TITLE ("title"):
   - Extract the EXACT main scientific title of the paper.
   - Do NOT select journal headers (e.g. "IEEE Transactions on...", "Nature", "Elsevier"), running titles, volume/issue numbers, arXiv IDs, or file names as the title.
   - Clean off leading numbers or footnote symbols.

2. AUTHORS ("authors"):
   - Extract author names as a clean JSON array of strings: ["Firstname Lastname", ...].
   - Strip professional/academic titles (Dr., Prof., PhD, Dean, Lecturer, etc.).
   - Strip email addresses, ORCID IDs, corresponding author markers (*, †), and superscript affiliation numbers (1, 2).
   - Do NOT include university or department names in the authors list.

3. AFFILIATIONS ("affiliations"):
   - Extract institutional affiliations (department, university, institute, city, country) as a clean string.
   - Do NOT include author names or emails in affiliations.

4. ABSTRACT & KEYWORDS:
   - Extract verbatim abstract text and keywords array.

5. STATISTICS ("stats"):
   - Count only what you can verify in text.

MANUSCRIPT CONTENT:
${chunkText(text, 20000)}

Respond ONLY with valid JSON:
{
  "title": "exact title string or empty string",
  "abstract": "exact abstract text or empty string",
  "keywords": ["keyword1", "keyword2"],
  "authors": ["Author Name 1", "Author Name 2"],
  "affiliations": "Department of CS, University Name, City, Country",
  "stats": {
    "wordCount": 0,
    "charCount": 0,
    "imageCount": 0,
    "tableCount": 0,
    "equationCount": 0,
    "pseudocodeCount": 0,
    "citationCount": 0,
    "referenceCount": 0
  }
}`;
}

export interface RankedJournal extends Journal {
  aimScopeMatchScore: number;
  reasoning: string;
}

export function rankJournals(reviewData: any): RankedJournal[] {
  const metadata = reviewData?.manuscriptMetadata || {};
  const title = (metadata.extractedTitle || "").toLowerCase();
  const abstract = (metadata.extractedAbstract || "").toLowerCase();
  const keywords = (metadata.keywords || []).map((k: any) => String(k).toLowerCase());
  
  const overallScore = reviewData?.overallScore || 70;
  const summary = (reviewData?.summary || "").toLowerCase();
  const suggestedDomains = (reviewData?.suggestedDomains || []).map((d: any) => String(d).toLowerCase());
  const strengths = (reviewData?.strengths || []).map((s: any) => String(s).toLowerCase());
  const weaknesses = (reviewData?.weaknesses || []).map((w: any) => String(w).toLowerCase());
  const scopeFit = (reviewData?.detailedReport?.scopeFit || "").toLowerCase();
  const methodsReport = (reviewData?.detailedReport?.methods || "").toLowerCase();

  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
    "from", "up", "about", "into", "over", "after", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "this", "that", "these", "those",
    "using", "based", "through", "we", "our", "paper", "manuscript", "study", "research"
  ]);

  const tokenize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  };

  const manuscriptTokens = new Set([
    ...tokenize(title),
    ...tokenize(abstract),
    ...tokenize(summary),
    ...tokenize(scopeFit),
    ...tokenize(methodsReport),
    ...keywords
  ]);

  // Extract AI recommended journals (from LLM)
  const aiRecommendedList = reviewData?.recommendedJournals || [];
  const matchedAiRecNames = new Set<string>();

  // 1. Process database journals and match with AI recommendations
  const dbRanked = JOURNAL_DB.map(journal => {
    // Check direct match with AI recommendation
    let aiRecMatch: any = null;
    const cleanJName = journal.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    for (const air of aiRecommendedList) {
      const airName = String(air?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanJName === airName || cleanJName.includes(airName) || airName.includes(cleanJName)) {
        aiRecMatch = air;
        matchedAiRecNames.add(airName);
        break;
      }
    }

    // 2. Keyword Overlap (35%)
    let keywordScore = 0;
    if (journal.keywords && journal.keywords.length > 0) {
      let matches = 0;
      journal.keywords.forEach((kw: string) => {
        const kwLower = kw.toLowerCase();
        
        // Full-word boundary check or inclusion check
        const isMatched = keywords.some((k: string) => k.includes(kwLower) || kwLower.includes(k)) ||
                          title.includes(kwLower) ||
                          abstract.includes(kwLower);
        if (isMatched) {
          matches++;
        }
      });
      // Jaccard-like keyword coefficient rather than dividing purely by journal keyword count
      keywordScore = (matches / Math.max(1, journal.keywords.length)) * 100;
    }

    // 3. Domain Match (25%)
    let domainScore = 0;
    if (journal.domains && journal.domains.length > 0) {
      let matchedDomains = 0;
      journal.domains.forEach((jd: string) => {
        const jdLower = jd.toLowerCase();
        const directDomainMatch = suggestedDomains.some((sd: string) => sd.includes(jdLower) || jdLower.includes(sd));
        const textDomainMatch = title.includes(jdLower) || abstract.includes(jdLower) || summary.includes(jdLower);
        if (directDomainMatch || textDomainMatch) {
          matchedDomains++;
        }
      });
      domainScore = (matchedDomains / journal.domains.length) * 100;
      if (matchedDomains > 0) {
        domainScore = Math.max(domainScore, 50);
      }
    }

    // 4. Score Fitness (20%)
    let scoreFitness = 0;
    const diff = overallScore - journal.minRecommendedScore;
    if (diff >= 0) {
      scoreFitness = Math.min(100, 80 + diff * 1.5);
    } else {
      scoreFitness = Math.max(20, 100 - Math.abs(diff) * 4.0);
    }

    // 5. Scope Semantic Overlap (10%)
    let scopeScore = 0;
    const scopeTokens = tokenize(journal.scopeText);
    if (scopeTokens.length > 0) {
      let matchedTokens = 0;
      scopeTokens.forEach((t: string) => {
        if (manuscriptTokens.has(t)) {
          matchedTokens++;
        }
      });
      scopeScore = (matchedTokens / scopeTokens.length) * 100;
    }

    // 6. Strength & Methodology Focus Alignment (5%)
    let strengthScore = 50;
    if (journal.methodologyFocus && journal.methodologyFocus.length > 0) {
      const matchCount = journal.methodologyFocus.filter((focus: string) => {
        const f = focus.toLowerCase();
        return strengths.some((s: string) => s.includes(f)) ||
               summary.includes(f) ||
               methodsReport.includes(f);
      }).length;
      strengthScore = (matchCount / journal.methodologyFocus.length) * 100;
    }

    // 7. Weakness Penalty (5%)
    let weaknessScore = 100;
    if (journal.methodologyFocus && journal.methodologyFocus.length > 0) {
      journal.methodologyFocus.forEach((focus: string) => {
        const f = focus.toLowerCase();
        const hasWeakness = weaknesses.some((w: string) => w.includes(f) && (
          w.includes("lack") || w.includes("weak") || w.includes("insufficient") || w.includes("limited")
        ));
        if (hasWeakness) {
          weaknessScore = Math.max(30, weaknessScore - 25);
        }
      });
    }

    // Base computed score
    let computedScore = Math.round(
      (keywordScore * 0.35) +
      (domainScore * 0.25) +
      (scoreFitness * 0.20) +
      (scopeScore * 0.10) +
      (strengthScore * 0.05) +
      (weaknessScore * 0.05)
    );

    // Apply boost if recommended by AI
    if (aiRecMatch) {
      const aiScore = aiRecMatch.aimScopeMatchScore || 90;
      computedScore = Math.round(aiScore * 0.75 + computedScore * 0.25);
    }

    const matchedKws = journal.keywords.filter((kw: string) => {
      const kwLower = kw.toLowerCase();
      return keywords.some((k: string) => k.includes(kwLower) || kwLower.includes(k)) || title.includes(kwLower) || abstract.includes(kwLower);
    });

    const kwPhrase = matchedKws.length > 0 
      ? `fits perfectly with your focus on ${matchedKws.slice(0, 2).join(" and ")}`
      : `aligns well with your research area in ${journal.domains[0]}`;

    let reasoning = "";
    if (aiRecMatch && aiRecMatch.reasoning) {
      reasoning = aiRecMatch.reasoning;
    } else {
      let ratingAdjective = "Excellent";
      if (computedScore < 60) ratingAdjective = "Potential";
      else if (computedScore < 75) ratingAdjective = "Good";
      else if (computedScore < 88) ratingAdjective = "Strong";
      reasoning = `${ratingAdjective} match for your manuscript. The journal's scope on "${journal.name}" ${kwPhrase}. ` +
        `With a peer-review score of ${overallScore} versus the journal's typical entry threshold of ${journal.minRecommendedScore}, ` +
        `this submission matches the publication standards. Matches the journal's preferred ${journal.methodologyFocus.join("/")} research methodology.`;
    }

    return {
      ...journal,
      aimScopeMatchScore: Math.min(100, Math.max(40, computedScore)),
      reasoning
    };
  });

  // 2. Add AI-recommended journals that are NOT in JOURNAL_DB as new entries
  const unmatchedAiRecommended = aiRecommendedList.filter((air: any) => {
    const airName = String(air?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return airName && !matchedAiRecNames.has(airName);
  });

  const unmatchedRanked = unmatchedAiRecommended.map((air: any) => {
    const name = air.name;
    const publisher = air.publisher || "Academic Publisher";
    const impactFactor = air.impactFactor || 3.5;
    const quartile = air.quartile || "Q1";
    const score = air.aimScopeMatchScore || 85;
    const reasoning = air.reasoning || `Recommended by AI reviewer based on manuscript domain, abstract keyword matching, and context analysis.`;

    const fallback: Journal = {
      name,
      publisher,
      quartile: quartile as any,
      accessType: "Open Access",
      apc: null,
      impactFactor,
      indexing: ["Google Scholar", "Crossref"],
      reviewTimeWeeks: air.avgWeeksToFirstDecision ? String(air.avgWeeksToFirstDecision) : "8-12",
      publicationTimeWeeks: air.avgWeeksToPublication ? String(air.avgWeeksToPublication) : "12-16",
      latexTemplateUrl: air.latexTemplateUrl || "https://www.overleaf.com/",
      homeUrl: air.homeUrl || "https://scholar.google.com/",
      domains: suggestedDomains.length > 0 ? suggestedDomains.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)) : ["General Science"],
      sjrScore: 1.2,
      keywords: keywords.length > 0 ? keywords.slice(0, 5) : [],
      scopeText: `A leading venue for research in ${name}.`,
      minRecommendedScore: Math.max(50, overallScore - 10),
      methodologyFocus: ["experimental"]
    };

    return {
      ...fallback,
      aimScopeMatchScore: Math.min(100, Math.max(40, score)),
      reasoning
    };
  });

  const combined = [...dbRanked, ...unmatchedRanked];

  return combined
    .sort((a, b) => b.aimScopeMatchScore - a.aimScopeMatchScore)
    .slice(0, 10);
}

export function matchJournals(suggestedDomains: string[], _minQuartile: string = "Q4"): Journal[] {
  return JOURNAL_DB.filter(journal => {
    const domainMatch = journal.domains.some(domain =>
      suggestedDomains.some(
        suggested =>
          suggested.toLowerCase().includes(domain.toLowerCase()) ||
          domain.toLowerCase().includes(suggested.toLowerCase())
      )
    );
    return domainMatch;
  }).slice(0, 10);
}

