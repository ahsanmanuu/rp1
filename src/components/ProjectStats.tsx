"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Image, Table, Sigma, Quote, Link2, Code2, Sparkles, BarChart3, AlertTriangle, X 
} from 'lucide-react';

interface ProjectStatsProps {
  stats: {
    wordCount: number;
    charCount: number;
    imageCount: number;
    chartCount: number;
    tableCount: number;
    equationCount: number;
    citationCount: number;
    referenceCount: number;
    pseudocodeCount: number;
  };
  metadata: {
    title: string;
    authors?: (string | any)[];
    organizations?: string[];
    abstract?: string;
    keywords?: string[];
    contribution?: string;
    structuredContent?: string;
  };
}

export const ProjectStats: React.FC<ProjectStatsProps> = ({ stats, metadata }) => {
  const displayStats = { ...stats };
  let metadataAuthors = metadata.authors || [];
  let metadataOrgs = metadata.organizations || [];
  let metadataKeywords = metadata.keywords || [];
  let metadataAbstract = metadata.abstract || "";
  let metadataContribution = metadata.contribution || "";

  if (metadata.structuredContent) {
    try {
      const parsed = JSON.parse(metadata.structuredContent);

      // ─── AUTHORITATIVE COUNTS: always derive from body/references arrays ───
      // parsed.stats is a cached snapshot that can be stale (written with an older
      // parser version). The body and references arrays are always faithfully stored.
      if (parsed.stats || parsed.body || parsed.references) {
        const body  = Array.isArray(parsed.body)       ? parsed.body       : [];
        const refs  = Array.isArray(parsed.references)  ? parsed.references  : [];

        // Walk body once — with equation validation
        let bTable = 0, bEq = 0, bChart = 0, bPseudo = 0, bFig = 0;
        body.forEach((n: any) => {
          if (n.type === 'table')     bTable++;
          if (n.type === 'chart')     bChart++;
          if (n.type === 'algorithm') bPseudo++;
          if (n.type === 'figure')    bFig++;
          if (n.type === 'figure-group' && n.images) bFig += n.images.length;

          if (n.type === 'equation') {
            // HTML/LaTeX-parser nodes always have a `latex` field — trust them unconditionally.
            if (n.latex != null) {
              bEq++;
              return;
            }
            // PDF-text nodes only have a `text` field.  The original parsePdfText detector
            // was too broad: it matched ANY alphanumeric line containing "=" and < 80 chars,
            // which tagged parameter assignments ("accuracy = 99.94", "LR = 0.0001"),
            // table rows, and figure-reference sentences as equations.
            // Re-validate them here so stored false-positives don't inflate the count.
            const raw = (n.text || '').trim();
            if (!raw) return;

            // Fast-reject: pure parameter/metric assignments ("Word = value")
            // e.g. "accuracy = 99.94", "LR = 0.0001", "Method = CNN", "BS = 8"
            const isParamAssign = /^[A-Za-z][A-Za-z0-9\s_]{0,30}\s*=\s*[\d.,+\-eE%]+\s*$/.test(raw)
                                || /^[A-Za-z][A-Za-z0-9\s_]{0,25}\s*=\s*[A-Za-z][A-Za-z0-9\s_]{0,25}$/.test(raw);
            if (isParamAssign) return;

            // Accept if it has Greek letters or special math symbols
            const hasGreek = /[∑∫≈≤≥≠≡α-ωΑ-Ωθλπμσδφψωηρ∀∃∈∉⊂⊃∪∩∧∨¬±∓×÷√∞]/.test(raw);
            // Accept if it has multiple arithmetic operators (real expression)
            const opCount = (raw.match(/[+\-*\/^]/g) || []).length;
            const hasMultiOps = opCount >= 2;
            // Accept if it uses math function names
            const hasMathFn = /\b(sin|cos|tan|log|ln|exp|sqrt|lim|max|min|sum|prod|det|tr|arg|sgn|softmax|sigmoid|relu|tanh)\b/i.test(raw);
            // Accept if it has subscript/superscript notation
            const hasSubSuper = /[_^][{\w]/.test(raw) || /\{[a-zA-Z0-9]+\}/.test(raw);
            // Accept if it ends with an equation number AND has actual math content
            const hasEqNum = /\(\d{1,3}\)\s*$/.test(raw);
            const hasRelOp = /[=<>]/.test(raw);
            const hasEqNumWithMath = hasEqNum && hasRelOp && (opCount >= 1 || hasGreek || hasMathFn);
            // Accept MATHBLOCKX markers (from HTML math pre-processing)
            const isMathMarker = /MATHBLOCKX\d+XMARKER/i.test(raw);

            if (hasGreek || hasMultiOps || hasMathFn || hasSubSuper || hasEqNumWithMath || isMathMarker) {
              bEq++;
            }
          }
        });

        // ─── REFERENCE SANITIZATION ─────────────────────────────────────────
        // Old projects may have guideline headings or instruction text stored in
        // the refs array (from a previous parser version). Apply the same validity
        // filter as isNewReferenceStart to get the accurate count universally.
        const validRefs = refs.filter((r: string) => {
          const t = r.trim();
          if (t.length < 10) return false;
          const hasYear       = /\b(19|20)\d{2}\b/.test(t);
          const hasQuotes     = /[""\u201c\u201d"'`']/.test(t);
          const hasRefKw      = /\b(?:vol|volume|no|issue|pp|pages|page|press|university|dept|department|journal|proceedings|proc|conf|conference|transactions|trans|ieee|acm|elsevier|springer|doi|https?|url|www|unpublished|submitted|in\s+press)\b/i.test(t);
          const hasNumPrefix  = /^\[?\d+\]?[\.\-\t\s]+/.test(t);
          // Must have at least ONE academic signal
          if (!hasYear && !hasQuotes && !hasRefKw && !hasNumPrefix) return false;
          // Reject obvious guideline headings (references within / references in the)
          if (/^references?\s+(?:within|in\s+the|at\s+the|inside|outside)\b/i.test(t)) return false;
          // Reject pure instruction sentences
          if (/\b(?:write|ensure|use|should|must|following|include|format|align|enclose|cite|citation\s+number)\b/i.test(t) && !hasNumPrefix) return false;
          return true;
        });

        const s = parsed.stats || {};
        // For each metric: live array count wins if > 0, then fall back to cached stats
        displayStats.wordCount       = s.wordCount      || displayStats.wordCount;
        displayStats.charCount       = s.charCount      || displayStats.charCount;
        displayStats.tableCount      = bTable   > 0 ? bTable   : (s.tableCount      || displayStats.tableCount);
        displayStats.equationCount   = bEq      > 0 ? bEq      : (s.equationCount   || displayStats.equationCount);
        displayStats.chartCount      = bChart   > 0 ? bChart   : (s.chartCount      || displayStats.chartCount);
        displayStats.pseudocodeCount = bPseudo  > 0 ? bPseudo  : (s.pseudocodeCount || displayStats.pseudocodeCount);
        // Use sanitized refs count — accurate for both new and old projects
        displayStats.referenceCount  = validRefs.length > 0 ? validRefs.length : (s.referenceCount || displayStats.referenceCount);
        displayStats.citationCount   = s.citationCount  || displayStats.citationCount;
        // Figure count: use body walk first, then DB file list (already in displayStats)
        if (bFig > 0) displayStats.imageCount = Math.max(bFig, displayStats.imageCount);
        else if (s.imageCount) displayStats.imageCount = displayStats.imageCount || s.imageCount;
        // chartCount is already set on line 88 — don't re-apply Max here (would double-inflate)
      }

      if (metadataAuthors.length === 0 && parsed.authors) metadataAuthors = parsed.authors;
      if (metadataOrgs.length === 0 && parsed.organizations) metadataOrgs = parsed.organizations;
      if (metadataKeywords.length === 0 && parsed.keywords) metadataKeywords = parsed.keywords;
      if (!metadataAbstract && parsed.abstract) metadataAbstract = parsed.abstract;
      if (!metadataContribution && parsed.contribution) metadataContribution = parsed.contribution;
    } catch (e) {
      // Fallback to DB columns
    }
  }

  const keywordsToUse = metadataKeywords || [];

  // --- Calculate Document Structural Health Score ---
  let healthScore = 50; // Base score
  if (metadataAbstract) healthScore += 15;
  if (keywordsToUse.length > 0) healthScore += 10;
  if (metadataContribution) healthScore += 10;
  if (metadataAuthors.length > 0) healthScore += 5;
  if (displayStats.referenceCount > 0) healthScore += 10;
  
  let healthColor = 'text-red-500';
  if (healthScore >= 90) healthColor = 'text-green-500';
  else if (healthScore >= 70) healthColor = 'text-amber-500';
  else if (healthScore >= 60) healthColor = 'text-blue-500';

  const [showHealthWarning, setShowHealthWarning] = useState(false);
  const openWarning = useCallback(() => setShowHealthWarning(true), []);
  const closeWarning = useCallback(() => setShowHealthWarning(false), []);

  useEffect(() => {
    if (healthScore <= 95) {
      setShowHealthWarning(true);
    }
  }, [healthScore]);

  return (
    <div className="space-y-12">
      {/* Title & Identity & Health */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
        <div className="space-y-6 flex-1">
          <h2 
            className="text-3xl font-black tracking-tight leading-tight text-justify"
            style={{ color: 'var(--report-text)', letterSpacing: '-0.03em' }}
          >
            {metadata.title}
          </h2>

          {keywordsToUse.length > 0 && (
            <p className="text-sm font-medium text-justify leading-relaxed" style={{ color: 'var(--muted-text)' }}>
              <span className="font-black uppercase tracking-wider text-[10px] mr-2" style={{ color: 'var(--accent-primary)' }}>Keywords:</span> 
              {keywordsToUse.join(', ')}
            </p>
          )}
          
          <div className="flex flex-wrap gap-10">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent-primary)' }}>Lead Investigator</p>
              <p className="text-lg font-bold italic" style={{ color: 'var(--report-text)' }}>
                {metadataAuthors.length > 0
                  ? metadataAuthors.map((a: any) => (typeof a === 'object' && a !== null ? (a.name || '') : (a || ''))).filter(Boolean).join(', ') || <span className="opacity-50 font-normal text-base">Not available</span>
                  : <span className="opacity-50 font-normal text-base">Not available</span>}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--muted-text)', opacity: 0.8 }}>Affiliations</p>
              <div className="flex flex-wrap gap-2">
                {metadataOrgs.length > 0 ? (
                  metadataOrgs.map((org: any, i: number) => (
                    <span key={i} className="text-sm font-bold" style={{ color: 'var(--muted-text)' }}>
                      {typeof org === 'string' ? org : (typeof org === 'object' && org !== null ? (org.name || JSON.stringify(org)) : String(org ?? ''))}
                      {i < metadataOrgs.length - 1 ? ' •' : ''}
                    </span>
                  ))
                ) : (
                  <span className="text-sm opacity-50">Not available</span>
                )}
      </div>

      {/* Health Score Warning Popup */}
      <AnimatePresence>
        {showHealthWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={closeWarning}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-[var(--strict-border)] shadow-2xl max-w-2xl w-full p-10 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeWarning}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors border border-[var(--strict-border)]"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle size={40} className="text-amber-500" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-black tracking-tight text-[var(--strict-text)]">
                    Health Score: {healthScore}
                  </h3>
                  <p className="text-justify leading-relaxed text-sm text-[var(--strict-text)] opacity-80 font-medium">
                    Your <strong>{healthScore}</strong> score must be <strong>100</strong> for perfect Doc2LaTeX Conversion, please restructure your Document and upload again otherwise rendered PDF will have some issues that has to be rectified by manual editing in LaTeX Codes in Editor.
                  </p>
                </div>

                <button
                  onClick={closeWarning}
                  className="mt-2 px-10 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl transition-colors shadow-lg"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
          </div>
        </div>

        {/* Structural Health Badge */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center p-8 bg-[var(--strict-bg)] rounded-[2.5rem] border border-[var(--strict-border)] shadow-sm min-w-[140px] cursor-pointer hover:shadow-lg transition-shadow"
          onClick={healthScore <= 95 ? openWarning : undefined}
          title={healthScore <= 95 ? "Click to see health warning" : ""}
        >
          {healthScore <= 95 && (
            <AlertTriangle size={18} className="text-amber-500 mb-1" />
          )}
          <span className={`text-5xl font-black ${healthColor}`}>{healthScore}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-3 text-center opacity-80">Health<br/>Score</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Words" value={displayStats.wordCount} icon={FileText} color="primary" />
        <MiniStat label="Characters" value={displayStats.charCount} icon={Sparkles} color="secondary" />
        <MiniStat label="Figures" value={displayStats.imageCount} icon={Image} color="tertiary" />
        <MiniStat label="Charts" value={displayStats.chartCount} icon={BarChart3} color="primary" />
        <MiniStat label="Tables" value={displayStats.tableCount} icon={Table} color="primary" />
        <MiniStat label="Equations" value={displayStats.equationCount} icon={Sigma} color="secondary" />
        <MiniStat label="Citations" value={displayStats.citationCount} icon={Quote} color="tertiary" />
        <MiniStat label="References" value={displayStats.referenceCount} icon={Link2} color="primary" />
        <MiniStat label="Algorithms" value={displayStats.pseudocodeCount} icon={Code2} color="secondary" />
      </div>

      {/* Intelligence Content */}
      <div className="space-y-8">
        {metadataAbstract && (
          <div className="bg-[var(--strict-bg)] p-10 rounded-[3rem] border border-[var(--strict-border)] shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center border border-[var(--strict-border)]">
                <Sparkles size={20} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--strict-text)] opacity-80">Executive Abstract</h4>
            </div>
            <p className="text-base leading-relaxed text-[var(--strict-text)] font-medium text-justify">
              {metadataAbstract}
            </p>
            
            <div className="flex flex-wrap gap-3 pt-6 border-t border-[var(--strict-border)]">
              {keywordsToUse.map((k: any, i: number) => (
                <span key={i} className="px-4 py-1.5 bg-primary-container-joy/10 text-primary-joy rounded-full text-[10px] font-black uppercase tracking-widest border border-[var(--strict-border)]">
                  {typeof k === 'string' ? k : (typeof k === 'object' && k !== null ? JSON.stringify(k) : String(k ?? ''))}
                </span>
              ))}
            </div>
          </div>
        )}

        {(displayStats.pseudocodeCount > 0 || (() => { try { return metadata.structuredContent ? JSON.parse(metadata.structuredContent).algorithms?.length > 0 : false; } catch { return false; } })()) && (
          <div className="bg-[var(--strict-bg)] p-10 rounded-[3rem] border border-[var(--strict-border)] shadow-sm space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center border border-[var(--strict-border)]">
                <Code2 size={20} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--strict-text)] opacity-80">Algorithm Discovery</h4>
            </div>
            
            <div className="space-y-6">
              {(() => {
                try {
                  const parsed = JSON.parse(metadata.structuredContent || '{}');
                  const algos = parsed.algorithms || [];
                  if (algos.length > 0) {
                    return algos.map((algo: any, i: number) => (
                      <div key={i} className="bg-[var(--strict-bg)] p-6 rounded-2xl border border-[var(--strict-border)] shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-black border border-[var(--strict-border)]">{i + 1}</div>
                          <h5 className="font-bold text-[var(--strict-text)]">{algo.title || `Algorithm ${i + 1}`}</h5>
                        </div>
                        <pre className="text-xs text-[var(--strict-text)] opacity-90 bg-slate-50 dark:bg-black/40 p-4 rounded-xl overflow-x-auto font-mono leading-relaxed border border-[var(--strict-border)]">
                          {algo.content}
                        </pre>
                      </div>
                    ));
                  }
                  return <p className="text-sm text-[var(--strict-text)] opacity-80 italic">Identified algorithmic structures are being mapped for LaTeX conversion.</p>;
                } catch (e) {
                  return null;
                }
              })()}
            </div>
          </div>
        )}

        {(displayStats.tableCount > 0 || (() => { try { return metadata.structuredContent ? JSON.parse(metadata.structuredContent).tables?.length > 0 : false; } catch { return false; } })()) && (
          <div className="bg-[var(--strict-bg)] p-10 rounded-[3rem] border border-[var(--strict-border)] shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center border border-[var(--strict-border)]">
                <Table size={20} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--strict-text)] opacity-80">Table Directory</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                try {
                  const parsed = JSON.parse(metadata.structuredContent || '{}');
                  const tables = parsed.tables || [];
                  if (tables.length > 0) {
                    return tables.map((tbl: any, i: number) => (
                      <div key={i} className="flex items-start gap-4 bg-[var(--strict-bg)] p-5 rounded-2xl border border-[var(--strict-border)] shadow-sm transition-all hover:border-[var(--accent-primary)] hover:shadow-md">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-black border border-[var(--strict-border)] shrink-0">{i + 1}</div>
                        <p className="text-sm font-medium text-[var(--strict-text)] leading-snug line-clamp-2">{tbl.caption}</p>
                      </div>
                    ));
                  }
                  return <p className="text-sm text-[var(--strict-text)] opacity-80 italic col-span-full">Tabular data identified and mapped.</p>;
                } catch (e) {
                  return null;
                }
              })()}
            </div>
          </div>
        )}

        {metadataContribution && (
          <div className="px-10 border-l-4 border-primary-joy py-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-joy mb-3">Core Contribution</h4>
            <p className="text-xl font-bold text-on-surface-joy italic leading-snug">
              &ldquo;{typeof metadataContribution === 'string' ? metadataContribution : JSON.stringify(metadataContribution)}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: 'primary' | 'secondary' | 'tertiary' }) => {
  const colorMap = {
    primary: 'text-primary-joy bg-primary-container-joy/10',
    secondary: 'text-secondary-joy bg-secondary-container-joy/10',
    tertiary: 'text-tertiary-joy bg-tertiary-container-joy/10'
  };

  return (
    <div className={`
      p-6 rounded-[2rem] border transition-all duration-300 group mini-stat-card
      bg-[var(--strict-bg)]
      border-[var(--strict-border)]
      shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]
      hover:shadow-md dark:hover:shadow-[0_8px_40px_rgba(0,104,95,0.15)] 
      hover:border-[var(--accent-primary)]
    `}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${colorMap[color]}`}>
        <Icon size={24} />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--strict-text)] opacity-80">{label}</p>
        <p className="text-2xl font-black text-[var(--strict-text)]">{(value ?? 0).toLocaleString()}</p>
      </div>
    </div>
  );
};
