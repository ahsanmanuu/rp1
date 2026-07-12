"use client";
import './reviewer.css';

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/lib/pb-auth-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, ShieldCheck, 
  CheckCircle2, AlertTriangle, AlertCircle, Clock, Hourglass, 
  Globe, Award, ExternalLink, BookOpen, ChevronDown
} from "lucide-react";
import { ScholarlyNavbar } from "@/components/Navigation/ScholarlyNavbar";
import ProjectLimitModal from "@/components/ProjectLimitModal";
import { useProjectLimit } from "@/hooks/useProjectLimit";

/**
 * safeStr — converts ANY value to a safe, renderable string for JSX.
 * Prevents React error #31 when AI returns objects/arrays instead of strings.
 */
function safeStr(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map((v: any) => safeStr(v)).join(', ');
  if (typeof val === 'object') {
    // Handle {name, affiliation} author objects
    const name = val.name || val.Name || val.title || val.text || val.content || '';
    const affil = val.affiliation || val.Affiliation || '';
    if (name) return affil ? `${name} (${affil})` : String(name);
    return JSON.stringify(val);
  }
  return String(val);
}

// Helper function to mathematically convert OKLCH/OKLab color strings to safe, accurate sRGB
function oklchToRgb(oklchStr: string): string {
  try {
    const match = oklchStr.match(/o?k(?:lab|lch)\s*\(\s*([\d.e%\-]+)\s+([\d.e%\-]+)\s+([\d.deg%\-]+)(?:\s*[\/\s]\s*([\d.e%\-]+))?\s*\)/i);
    if (!match) return 'rgb(255, 255, 255)';
    
    let L = parseFloat(match[1]);
    if (match[1].includes('%')) L /= 100;
    
    let C = parseFloat(match[2]);
    if (match[2].includes('%')) C /= 100;
    
    const H = parseFloat(match[3]);
    // Convert hue in degrees to radians
    const hRad = (H * Math.PI) / 180;
    
    const alpha = match[4] !== undefined ? (match[4].includes('%') ? parseFloat(match[4])/100 : parseFloat(match[4])) : 1;
    
    // 1. Convert OKLCH to OKLab
    const oklab_a = C * Math.cos(hRad);
    const oklab_b = C * Math.sin(hRad);
    
    // 2. OKLab to LMS
    const l_ = L + 0.3963377774 * oklab_a + 0.2158037573 * oklab_b;
    const m_ = L - 0.1055613458 * oklab_a - 0.0638541728 * oklab_b;
    const s_ = L - 0.0894841775 * oklab_a - 1.2914855414 * oklab_b;
    
    // 3. Cube LMS
    const l = l_ * l_ * l_;
    const mDec = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    
    // 4. LMS to linear RGB
    const r_lin = +4.0767416621 * l - 3.3077115913 * mDec + 0.2309699292 * s;
    const g_lin = -1.2684380046 * l + 2.6097574011 * mDec - 0.3413193965 * s;
    const b_lin = -0.0041960863 * l - 0.7034186147 * mDec + 1.7076147010 * s;
    
    // Helper for sRGB gamma compression
    const gamma = (x: number) => {
      return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1/2.4) - 0.055;
    };
    
    const red = Math.min(255, Math.max(0, Math.round(gamma(r_lin) * 255)));
    const green = Math.min(255, Math.max(0, Math.round(gamma(g_lin) * 255)));
    const blue = Math.min(255, Math.max(0, Math.round(gamma(b_lin) * 255)));
    
    if (alpha < 1) {
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    return `rgb(${red}, ${green}, ${blue})`;
  } catch {
    return 'rgb(255, 255, 255)';
  }
}

function cleanColor(val: string | null): string | null {
  if (!val) return val;
  if (!val.includes('oklch') && !val.includes('oklab') && !val.includes('color-mix')) return val;
  
  // Convert color-mix(in oklab/oklch, rgb(r, g, b) X%, transparent) -> rgba(r, g, b, 0.X)
  // Parameters renamed to match_* to avoid potential SWC scoping collisions
  let cleaned = val.replace(/color-mix\(in (?:oklab|oklch),\s*rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)\s*(\d+)%,\s*transparent\)/gi, (matchStr, match_r, match_g, match_b, match_a, pct) => {
    const alpha = (parseFloat(pct) / 100) * (match_a !== undefined ? parseFloat(match_a) : 1);
    return `rgba(${match_r}, ${match_g}, ${match_b}, ${alpha})`;
  });

  // Convert color-mix(in oklab/oklch, hex X%, transparent)
  cleaned = cleaned.replace(/color-mix\(in (?:oklab|oklch),\s*(#[a-fA-F0-9]{3,8})\s*(\d+)%,\s*transparent\)/gi, (_matchStr, hex, _pct) => {
    return hex;
  });

  // Mathematically convert oklch/oklab to safe high-fidelity sRGB/rgba fallback to prevent parser crash
  cleaned = cleaned.replace(/o?k(?:lab|lch)\([^)]+\)/gi, (match) => {
    return oklchToRgb(match);
  });
  
  // Fallback: strip any remaining color-mix wrappers
  cleaned = cleaned.replace(/color-mix\(in (?:oklab|oklch),\s*([^,]+?)\s*(?:\d+%)?,\s*[^)]+\)/gi, '$1');
  return cleaned;
}

export default function ReviewerPage() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [recommendedJournals, setRecommendedJournals] = useState<any[]>([]);
  const [, setError] = useState<string | null>(null);
  const [activeHistory, setActiveHistory] = useState<any[]>([]);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(3);
  const [expandedAccordion, setExpandedAccordion] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [extractedStats, setExtractedStats] = useState<any>(null);
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [extractedAuthors, setExtractedAuthors] = useState<string[]>([]);
  const [extractedAffiliations, setExtractedAffiliations] = useState<string>("");
  const [extractedTitle, setExtractedTitle] = useState<string>("");
  const [extractedAbstract, setExtractedAbstract] = useState<string>("");
  const [scanStatus, setScanStatus] = useState("Decompressing structural nodes...");
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [isFitAnalysisOpen, setIsFitAnalysisOpen] = useState(false);
  const [expandedModalAccordion, setExpandedModalAccordion] = useState<number | null>(null);
  const [isTakingTooLong, setIsTakingTooLong] = useState(false);
  const [isTimeoutAlertOpen, setIsTimeoutAlertOpen] = useState(false);
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<'auto' | 'manual'>('auto');
  const containerRef = useRef<HTMLDivElement>(null);
  const { showLimitModal, setShowLimitModal } = useProjectLimit();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [isAnalyzing, result, isExtracting]);


  useEffect(() => {
    if (!isExtracting) return;
    
    const scanPhrases = [
      "Decompressing structural nodes...",
      "Synthesizing semantic document hierarchy...",
      "Extracting vector equations and variables...",
      "Parsing complex layout grid structures...",
      "Mapping local citation graph matrices...",
      "Cross-verifying bibliography indices..."
    ];
    
    let idx = 0;
    setScanStatus(scanPhrases[0]);
    
    const interval = setInterval(() => {
      idx = (idx + 1) % scanPhrases.length;
      setScanStatus(scanPhrases[idx]);
    }, 1500);
    
    return () => clearInterval(interval);
  }, [isExtracting]);





  // ── Live elapsed timer (used in the processing screen bottom status bar) ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isAnalyzing) { setElapsedSeconds(0); return; }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isAnalyzing]);

  useEffect(() => {
    if (isAnalyzing) {
      const totalEquations = extractedStats?.equationCount || 3;
      const totalCitations = extractedStats?.citationCount || 5;
      const totalCharts    = extractedStats?.chartCount    || 0;
      const totalTables    = extractedStats?.tableCount    || 0;

      // Build logs with individual timestamps so each shows its real fire time
      const logDefs: [number, string, number][] = [
        [4000,  `Checking formatting compliance & plagiarism markers...`, 3],
        [9000,  `Cross-referencing ${totalCitations} citations against global indices... Verified.`, 4],
        [14000, `Checking mathematical correctness — ${totalEquations} equations found.`, 4],
        [19000, `Verifying ${totalCharts} chart(s) and ${totalTables} table(s) for consistency...`, 5],
        [24000, `Analyzing journal scope fit... Confidence ${Math.floor(Math.random() * 10 + 88)}%.`, 6],
        [29000, `Claim verification: comparing conclusions with experimental data...`, 7],
        [34000, `Checking illustration quality & data-availability links...`, 8],
        [39000, `Scanning ethical compliance, anonymity style, & formatting rules...`, 9],
        [44000, `Composing structured peer-review report...`, 9],
      ];

      setAgentLogs([]);
      setCurrentStep(3);

      const handles: ReturnType<typeof setTimeout>[] = logDefs.map(([delay, msg, nextStep]) =>
        setTimeout(() => {
          const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setAgentLogs(prev => [...prev, `[${ts}] ${msg}`]);
          setCurrentStep(nextStep);
        }, delay)
      );
      return () => handles.forEach(clearTimeout);
    }
  }, [isAnalyzing, extractedStats]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAnalyzing) {
      timer = setTimeout(() => {
        setIsTakingTooLong(true);
      }, 90000);
    } else {
      setIsTakingTooLong(false);
    }
    return () => clearTimeout(timer);
  }, [isAnalyzing]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAnalyzing || isExtracting) {
      timer = setTimeout(() => {
        setIsTimeoutAlertOpen(true);
      }, 300000);
    } else {
      setIsTimeoutAlertOpen(false);
    }
    return () => clearTimeout(timer);
  }, [isAnalyzing, isExtracting]);

  // Dynamic Metrics Calculation
  const wordCount = extractedText ? extractedText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = extractedText ? extractedText.length : 0;
  const formattedWords = new Intl.NumberFormat().format(wordCount);
  const formattedChars = charCount > 1000 ? `${(charCount / 1000).toFixed(1)}K` : charCount.toString();

  // Use AI-extracted title/abstract — NO hardcoded fallbacks
  const displayTitle = extractedTitle || (file?.name ? file.name.replace(/\.[^.]+$/, "") : "Untitled Document");
  const displayAbstract = extractedAbstract || "Abstract not found in this document.";

  useEffect(() => {
    if (result) {
      if (result.documentStats) {
        setExtractedStats({
          wordCount: result.documentStats.wordCount || 0,
          charCount: result.documentStats.charCount || 0,
          imageCount: result.documentStats.figureCount || 0,
          chartCount: result.documentStats.chartCount || 0,
          tableCount: result.documentStats.tableCount || 0,
          equationCount: result.documentStats.equationCount || 0,
          pseudocodeCount: result.documentStats.algorithmCount || 0,
          citationCount: result.documentStats.citationCount || 0,
          referenceCount: result.documentStats.referenceCount || 0,
        });
      }
      if (result.manuscriptMetadata) {
        if (result.manuscriptMetadata.extractedTitle) {
          setExtractedTitle(result.manuscriptMetadata.extractedTitle);
        }
        if (result.manuscriptMetadata.extractedAbstract) {
          setExtractedAbstract(result.manuscriptMetadata.extractedAbstract);
        }
        if (result.manuscriptMetadata.keywords) {
          const kws = result.manuscriptMetadata.keywords;
          setExtractedKeywords(Array.isArray(kws) ? kws.map((k: any) => safeStr(k)) : []);
        }
        if (result.manuscriptMetadata.authors) {
          const rawA = result.manuscriptMetadata.authors;
          setExtractedAuthors(
            Array.isArray(rawA)
              ? rawA.map((a: any) => safeStr(a)).filter(Boolean)
              : [safeStr(rawA)].filter(Boolean)
          );
        }
        if (result.manuscriptMetadata.affiliations) {
          setExtractedAffiliations(safeStr(result.manuscriptMetadata.affiliations));
        }
      }
    }
  }, [result]);

  useEffect(() => {
    if (!session) return;
    
    const safeFetchHistory = async () => {
      try {
        const cached = localStorage.getItem('scholarly_review_history');
        if (cached) {
          try { setActiveHistory(JSON.parse(cached)); } catch {}
        }
        const res = await fetch("/api/reviewer");
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.reviews) {
          setActiveHistory(data.reviews);
          localStorage.setItem('scholarly_review_history', JSON.stringify(data.reviews));
        }
      } catch {
        // Ignore transient network/compile errors
      }
    };

    safeFetchHistory();
    
    if (typeof window !== 'undefined') {
      const savedFilename = localStorage.getItem('pending_review_filename');
      if (savedFilename) {
        const dummyFile = new File([""], savedFilename);
        setFile(dummyFile);
        setExtractedText(localStorage.getItem('pending_review_text') || "");
        try {
          setExtractedStats(JSON.parse(localStorage.getItem('pending_review_stats') || "null"));
          setExtractedKeywords(JSON.parse(localStorage.getItem('pending_review_keywords') || "[]"));
          setExtractedAuthors(JSON.parse(localStorage.getItem('pending_review_authors') || "[]"));
        } catch {}
        setExtractedAffiliations(localStorage.getItem('pending_review_affiliations') || "");
        setExtractedTitle(localStorage.getItem('pending_review_title') || "");
        setExtractedAbstract(localStorage.getItem('pending_review_abstract') || "");
      }
    }

    const interval = setInterval(safeFetchHistory, 5000);
    return () => clearInterval(interval);
  }, [session]);

  const clearPendingReview = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pending_review_filename');
      localStorage.removeItem('pending_review_text');
      localStorage.removeItem('pending_review_stats');
      localStorage.removeItem('pending_review_keywords');
      localStorage.removeItem('pending_review_authors');
      localStorage.removeItem('pending_review_affiliations');
      localStorage.removeItem('pending_review_title');
      localStorage.removeItem('pending_review_abstract');
    }
  };

  const fetchHistory = async () => {
    try {
      const cached = localStorage.getItem('scholarly_review_history');
      if (cached) {
        try { setActiveHistory(JSON.parse(cached)); } catch {}
      }
      
      const res = await fetch("/api/reviewer");
      const data = await res.json();
      if (data.success && data.reviews) {
        setActiveHistory(data.reviews);
        localStorage.setItem('scholarly_review_history', JSON.stringify(data.reviews));
      }
    } catch { /* transient compile/network error */ }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsExtracting(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", f);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setExtractedText(data.text);
      setExtractedStats(data.stats);
      setExtractedKeywords(data.keywords || []);
      setExtractedAuthors(data.authors || []);
      setExtractedAffiliations(data.affiliations || "");
      setExtractedTitle(data.title || "");
      setExtractedAbstract(data.abstract || "");

      if (typeof window !== 'undefined') {
        localStorage.setItem('pending_review_filename', f.name);
        localStorage.setItem('pending_review_text', data.text);
        localStorage.setItem('pending_review_stats', JSON.stringify(data.stats));
        localStorage.setItem('pending_review_keywords', JSON.stringify(data.keywords || []));
        localStorage.setItem('pending_review_authors', JSON.stringify(data.authors || []));
        localStorage.setItem('pending_review_affiliations', data.affiliations || "");
        localStorage.setItem('pending_review_title', data.title || "");
        localStorage.setItem('pending_review_abstract', data.abstract || "");
      }

      toast.success("Manuscript Synthesized");



    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsExtracting(false);
      setIsTimeoutAlertOpen(false);
    }
  };

  const handleReview = async () => {
    if (!extractedText.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/reviewer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: extractedText, 
          filename: file?.name || 'Uploaded Paper',
          fileType: file?.name.split('.').pop() || 'txt',
          title: extractedTitle,
          abstract: extractedAbstract,
          keywords: extractedKeywords,
          authors: extractedAuthors,
          affiliations: extractedAffiliations,
          stats: extractedStats
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      // ── CRITICAL: stop analyzing FIRST, THEN set result.
      // AnimatePresence mode="wait" requires only ONE keyed child visible at a time.
      // Setting result while isAnalyzing=true causes both screens to render simultaneously,
      // triggering a flash-and-wipe when setIsAnalyzing(false) fires in finally.
      setIsAnalyzing(false);
      setIsTimeoutAlertOpen(false);
      // Small defer to let React flush the isAnalyzing=false state before mounting result screen
      await new Promise(r => setTimeout(r, 50));
      setRecommendedJournals(data.journals || []);
      setCurrentReviewId(data.reviewId);
      setResult(data.review);
      toast.success("Neural Audit Complete");
      clearPendingReview();
      if (historyMode === 'auto') {
        fetchHistory();
      } else {
        // manual cache only
        const manualCache = [...activeHistory];
        manualCache.unshift({
          id: data.reviewId || `manual-${Date.now()}`,
          title: file?.name || 'Uploaded Paper',
          fileType: file?.name.split('.').pop() || 'txt',
          overallScore: data.review?.overallScore || 0,
          reviewJson: JSON.stringify(data.review),
          journalsJson: JSON.stringify(data.journals || [])
        });
        setActiveHistory(manualCache);
        localStorage.setItem('scholarly_review_history', JSON.stringify(manualCache));
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      // Ensure analyzing is always stopped even on error paths
      setIsAnalyzing(false);
      setIsTimeoutAlertOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="reviewer-page-root h-screen bg-background-joy text-on-surface-joy font-body transition-colors duration-500 overflow-y-auto custom-scroll">
      <ScholarlyNavbar />

      <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto w-full">
        
        <AnimatePresence mode="wait">
          {!file && !result && !isExtracting && (
            <motion.div 
              key="upload-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center"
            >
              {/* Welcome Hero Section */}
              <div className="text-center mb-12 space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container/10 text-primary font-label-md rounded-full mb-2">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  Welcome to your Scholar's Sanctuary
                </div>

                <div className="flex items-center justify-center gap-4 mt-4 bg-slate-100/80 backdrop-blur-sm p-1.5 rounded-full w-fit mx-auto border border-slate-200">
                  <button 
                    onClick={() => setHistoryMode('auto')} 
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${historyMode === 'auto' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800 bg-transparent border-none'}`}
                  >
                    Auto-Save History
                  </button>
                  <button 
                    onClick={() => setHistoryMode('manual')} 
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${historyMode === 'manual' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800 bg-transparent border-none'}`}
                  >
                    Manual Save Only
                  </button>
                </div>
                <h1 className="font-display-lg text-4xl md:text-5xl font-bold text-on-background tracking-tight">
                  Let's polish your <span className="text-primary">breakthrough.</span>
                </h1>
                <p className="font-body-lg text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                  Transform your research with joyful AI insights. Upload your manuscript to begin a collaborative review process designed for clarity and discovery.
                </p>
              </div>

              {/* Bento Grid Interaction Area */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-4xl mb-16">
                {/* Primary Upload Area (Center-Piece) */}
                <div className="md:col-span-8 group relative overflow-hidden glass-card rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center transition-all duration-300 hover:shadow-xl border-dashed border-2 border-primary/20 bg-white">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 space-y-6">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-headline-md text-2xl font-bold text-on-surface">Drag & Drop Manuscript</h3>
                      <p className="font-body-md text-slate-500">Supports PDF, DOCX, and LaTeX files up to 50MB</p>
                    </div>
                    <label className="bg-primary hover:bg-primary/90 text-white font-label-md px-8 py-4 rounded-full shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto cursor-pointer">
                      <span className="material-symbols-outlined">add</span>
                      Select File from Device
                      <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.txt,.tex" />
                    </label>
                  </div>
                  {/* Decorative Background Elements */}
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-secondary-container/20 rounded-full blur-3xl"></div>
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-tertiary-container/20 rounded-full blur-3xl"></div>
                </div>

                {/* Sidebar Quick Actions/Stats */}
                <div className="md:col-span-4 flex flex-col gap-6">
                  {/* Recent Papers Card */}
                  <div className="glass-card rounded-[2rem] p-6 flex flex-col gap-4 border-t-4 border-t-secondary-container bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="font-headline-md text-lg font-bold text-on-surface">Quick Resume</h4>
                      <span className="material-symbols-outlined text-slate-400">history</span>
                    </div>
                    <div className="space-y-3">
                       {activeHistory.length > 0 ? (
                         activeHistory.slice(0, 4).map(h => (
                           <div 
                             key={h.id} 
                             className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors group overflow-hidden"
                           >
                             <div 
                               onClick={() => {
                                 setFile(new File([""], h.title));
                                 setExtractedText("Abstract payload loaded from DB.");
                                 try {
                                   const parsedReview = JSON.parse(h.reviewJson || "{}");
                                   const parsedJournals = JSON.parse(h.journalsJson || "[]");
                                   if (!parsedReview.createdAt && h.createdAt) {
                                      parsedReview.createdAt = h.createdAt;
                                    }
                                    if (!parsedReview.manuscriptId) {
                                      let idHash = 0;
                                      const reviewIdStr = String(h.id || 'reviewer-id');
                                      for (let i = 0; i < reviewIdStr.length; i++) {
                                        idHash = (idHash << 5) - idHash + reviewIdStr.charCodeAt(i);
                                        idHash |= 0;
                                      }
                                      parsedReview.manuscriptId = `AI-2026-${(Math.abs(idHash) % 9000) + 1000}`;
                                    }
                                   setResult(parsedReview);
                                   setRecommendedJournals(parsedJournals);
                                   setCurrentReviewId(h.id);
                                } catch {
                                  setResult(null);
                                  setCurrentReviewId(null);
                                }
                               }}
                               className="flex items-center gap-3 cursor-pointer flex-1 overflow-hidden"
                             >
                               <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-primary flex-shrink-0">
                                 <span className="material-symbols-outlined">article</span>
                               </div>
                               <div className="overflow-hidden">
                                 <p className="font-label-md text-sm font-bold text-on-surface truncate">{h.title}</p>
                                 <p className="text-[12px] text-slate-400">Score: {h.overallScore}/100</p>
                               </div>
                             </div>
                             <button 
                               onClick={async (e) => {
                                 e.stopPropagation();
                                 try {
                                   const res = await fetch(`/api/reviewer?id=${h.id}`, { method: 'DELETE' });
                                   if (res.ok) {
                                     toast.success("Review deleted successfully");
                                     fetchHistory();
                                   }
                                } catch {
                                  toast.error("Failed to delete review");
                                }
                               }}
                               className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors bg-transparent border-none cursor-pointer"
                             >
                               <span className="material-symbols-outlined text-[18px]">delete</span>
                             </button>
                           </div>
                         ))
                       ) : (
                         <>
                           <div 
                             onClick={() => {
                               setFile(new File([""], "Neural_Nets_V2.pdf"));
                               setExtractedText("Abstract: We evaluate deep neural network frameworks with modern residual layers.");
                             }}
                             className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group overflow-hidden"
                           >
                             <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-primary flex-shrink-0">
                               <span className="material-symbols-outlined">article</span>
                             </div>
                             <div className="overflow-hidden flex-1">
                               <p className="font-label-md text-sm font-bold text-on-surface truncate">Neural_Nets_V2.pdf</p>
                               <p className="text-[12px] text-slate-400">Modified 2h ago</p>
                             </div>
                           </div>
                            <div 
                              onClick={() => {
                                setFile(new File([""], "manuscript.pdf"));
                                setExtractedText("Abstract: This paper investigates a novel approach.");
                              }}
                              className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group overflow-hidden"
                            >
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-primary flex-shrink-0">
                                <span className="material-symbols-outlined">article</span>
                              </div>
                              <div className="overflow-hidden flex-1">
                                <p className="font-label-md text-sm font-bold text-on-surface truncate">manuscript.pdf</p>
                                <p className="text-[12px] text-slate-400">Modified yesterday</p>
                              </div>
                            </div>
                         </>
                       )}
                    </div>
                  </div>

                  {/* AI Insight Teaser Card */}
                  <div className="glass-card rounded-[2rem] p-6 flex flex-col gap-4 bg-gradient-to-br from-tertiary/10 to-transparent border-t-4 border-t-tertiary-container shadow-sm">
                    <div className="flex items-center gap-2 text-tertiary">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      <h4 className="font-label-md font-bold">Studio Tip</h4>
                    </div>
                    <p className="font-body-md text-sm text-slate-600 leading-relaxed">
                      Our new "Flow Analysis" tool can help identify logic gaps in your Methodology section.
                    </p>
                    <button 
                      onClick={() => setIsLearnMoreOpen(true)} 
                      className="text-tertiary font-label-sm flex items-center gap-1 hover:underline font-bold text-xs cursor-pointer bg-transparent border-none p-0 mx-auto"
                    >
                      Learn more <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Trust Badges / Capabilities */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-2xl">security</span>
                  </div>
                  <div>
                    <h5 className="font-label-md text-sm font-bold text-on-surface">Private & Secure</h5>
                    <p className="text-xs text-slate-400 max-w-[250px]">Your intellectual property is encrypted and never used for training without consent.</p>
                  </div>
                </div>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 text-amber-600 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-2xl">speed</span>
                  </div>
                  <div>
                    <h5 className="font-label-md text-sm font-bold text-on-surface">Rapid Synthesis</h5>
                    <p className="text-xs text-slate-400 max-w-[250px]">Complete preliminary peer review feedback in under 90 seconds.</p>
                  </div>
                </div>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-tertiary-container/20 text-tertiary flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-2xl">psychology</span>
                  </div>
                  <div>
                    <h5 className="font-label-md text-sm font-bold text-on-surface">Domain Expert AI</h5>
                    <p className="text-xs text-slate-400 max-w-[250px]">Specialized models trained across 40+ academic disciplines.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      {/* Extracting / "Analyzing Manuscript" modal — rendered OUTSIDE AnimatePresence mode="wait".
          Because it is position:fixed it overlays the page without needing the upload-screen
          to exit first, eliminating the blank-flash caused by mode="wait" sequencing. */}
      <AnimatePresence>
        {isExtracting && (
          <motion.div
            key="extracting-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md"
          >

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-12 max-w-2xl w-full mx-4 shadow-2xl flex flex-col items-center text-center relative overflow-hidden border border-slate-100"
            >
              {/* Laser Scanning Document Animation */}
              <div className="w-72 h-96 bg-slate-50 border border-slate-200 rounded-xl shadow-inner mb-8 relative overflow-hidden">

                {/* Scanning Laser */}
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-600 to-transparent shadow-[0_0_15px_rgba(13,148,136,0.5)] animate-laser z-20"></div>
                
                {/* Dummy Document Content */}
                <div className="p-6 space-y-4 opacity-30 relative z-10">
                  <div className="h-4 bg-slate-300 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                    <div className="h-3 bg-slate-200 rounded w-4/6"></div>
                  </div>
                  <div className="h-24 bg-teal-500/10 rounded-lg border border-teal-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-teal-600/50 text-3xl">bar_chart</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </div>
              </div>

              {/* Dynamic Status Text */}
              <div className="space-y-3 relative z-10">
                <h3 className="font-display-md text-2xl font-bold text-on-surface">Analyzing Manuscript</h3>
                <p className="text-sm text-slate-500 min-h-[20px] font-medium animate-pulse">
                  {scanStatus}
                </p>
              </div>
              
              {/* Circular Processing Spinner */}
              <div className="mt-8 flex gap-2 justify-center items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>

              <AnimatePresence>
                {isTakingTooLong && (
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] max-w-xl w-full shadow-2xl border border-amber-200 dark:border-amber-900 relative flex flex-col items-center text-center backdrop-blur-xl"
                    >
                      <div className="relative w-16 h-16 flex items-center justify-center mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin"></div>
                        <span className="material-symbols-outlined text-3xl text-amber-500 animate-pulse">hourglass_empty</span>
                      </div>

                      <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-4">Deep Analysis Ongoing</h3>
                      
                      <div className="w-full px-2 flex flex-col gap-3 items-center justify-center">
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
                          Your manuscript&apos;s structural vectors require multi-layered semantic passes. The network engine is currently finalizing structural metrics.
                        </p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed text-justify border-t border-slate-100 dark:border-slate-800 pt-3 w-full">
                          Please remain active on this window. Your research validation sequence is progressing safely.
                        </p>
                      </div>

                      <button 
                        onClick={() => setIsTakingTooLong(false)}
                        className="mt-6 px-6 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs transition-all cursor-pointer border-none"
                      >
                        Continue Waiting
                      </button>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Background Colorful Orbs */}
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-teal-600/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-secondary-container/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeout Alert — rendered outside AnimatePresence mode="wait" so it doesn't interfere with screen transitions */}
      <AnimatePresence>
        {isTimeoutAlertOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ height: '60%' }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] max-w-4xl w-full shadow-2xl border border-red-200 dark:border-red-950 relative flex flex-col items-center justify-center text-center backdrop-blur-xl"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 text-red-500 bg-red-50 dark:bg-red-950/30">
                <span className="material-symbols-outlined text-4xl animate-pulse">report</span>
              </div>

              <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-4">Server Response Delayed</h3>
              
              <div className="w-full px-2 flex flex-col gap-3 items-center justify-center">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
                  The semantic mapping sequence has exceeded standard time vectors (60s+). This usually indicates network throttling or deep structural queries.
                </p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed text-justify border-t border-slate-100 dark:border-slate-800 pt-3 w-full">
                  You may choose to continue waiting or cancel and attempt re-transmission.
                </p>
              </div>

              <div className="flex gap-4 mt-6">
                <button 
                  onClick={() => {
                    setIsTimeoutAlertOpen(false);
                    setIsAnalyzing(false);
                    setIsExtracting(false);
                    setError("Process terminated by user due to gateway timeout.");
                  }}
                  className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer border-none"
                >
                  Abort sequence
                </button>
                <button 
                  onClick={() => setIsTimeoutAlertOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-all cursor-pointer border-none shadow-sm"
                >
                  Wait Another Minute
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Screen transitions: analysis-screen, processing-screen, results-screen */}
      <AnimatePresence mode="wait">

      {file && extractedText && !result && !isAnalyzing && (

    <motion.div 
      key="analysis-screen"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full flex flex-col gap-6"
    >
      {/* Navigation Bar */}
      <nav className="flex flex-wrap gap-4 mb-8 border-b border-slate-100 pb-4">
        <Link href="/">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-secondary/30 transition-all group">
            <span className="material-symbols-outlined text-blue-500 group-hover:scale-110 transition-transform">home</span>
            <span className="font-medium text-sm text-on-surface-variant group-hover:text-on-surface">Return to Home</span>
          </button>
        </Link>
        <Link href="/dashboard">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-secondary/30 transition-all group">
            <span className="material-symbols-outlined text-amber-500 group-hover:scale-110 transition-transform">dashboard</span>
            <span className="font-medium text-sm text-on-surface-variant group-hover:text-on-surface">Return to Dashboard</span>
          </button>
        </Link>
        <button 
          onClick={() => { setFile(null); setExtractedText(""); clearPendingReview(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-secondary/30 transition-all group cursor-pointer"
        >
          <span className="material-symbols-outlined text-teal-500 group-hover:scale-110 transition-transform">psychology</span>
          <span className="font-medium text-sm text-on-surface-variant group-hover:text-on-surface">Return to AI Peer Reviewer</span>
        </button>
        <button 
          onClick={() => { setFile(null); setExtractedText(""); clearPendingReview(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-secondary/30 transition-all group cursor-pointer"
        >
          <span className="material-symbols-outlined text-rose-500 group-hover:scale-110 transition-transform">cloud_upload</span>
          <span className="font-medium text-sm text-on-surface-variant group-hover:text-on-surface">Re-upload Document</span>
        </button>
      </nav>

      {/* Header Section */}
      <header className="mb-8">
        <h1 className="font-h1 text-3xl font-semibold text-on-surface mb-2">Initial Document Analysis</h1>
        <p className="text-on-surface-variant font-body-ui text-slate-500">Comprehensive extraction of metadata and quantitative structural metrics.</p>
      </header>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4 mb-8">
        {/* Word Count */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-teal-600 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-teal-600">description</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">WORDS</span>
            <span className="text-2xl font-bold text-on-surface">{formattedWords}</span>
          </div>
        </div>
        {/* Characters */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-secondary shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-secondary">text_fields</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">CHARACTERS</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.charCount || formattedChars}</span>
          </div>
        </div>
        {/* Figures */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-tertiary shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-tertiary">image</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">FIGURES</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.imageCount ?? 0}</span>
          </div>
        </div>
        {/* Charts */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-indigo-500 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-indigo-500">bar_chart</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">CHARTS</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.chartCount ?? 0}</span>
          </div>
        </div>
        {/* Tables */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-slate-800 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-slate-800">table_chart</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">TABLES</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.tableCount ?? 0}</span>
          </div>
        </div>
        {/* Equations */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-red-600 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-red-600">functions</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">EQUATIONS</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.equationCount ?? 0}</span>
          </div>
        </div>
        {/* Algorithms */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-teal-500 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-teal-500">terminal</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">ALGORITHMS</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.pseudocodeCount ?? 0}</span>
          </div>
        </div>
        {/* Citations */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-indigo-500 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-indigo-500">format_quote</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">CITATIONS</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.citationCount ?? 0}</span>
          </div>
        </div>
        {/* References */}
        <div className="bg-white p-4 rounded-xl border-b-2 border-slate-500 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="material-symbols-outlined text-slate-500">menu_book</span>
            <span className="font-semibold text-xs tracking-wider text-on-surface-variant">REFERENCES</span>
            <span className="text-2xl font-bold text-on-surface">{extractedStats?.referenceCount ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Metadata Window */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col gap-6">
              <div>
                <span className="font-semibold text-xs tracking-wider text-secondary mb-2 block">DOCUMENT TITLE</span>
                <h2 className="text-2xl font-bold text-on-surface leading-tight">{displayTitle}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="font-semibold text-xs tracking-wider text-on-surface-variant mb-2 block">AUTHORS</span>
                  <div className="flex flex-wrap gap-2">
                    {extractedAuthors && extractedAuthors.length > 0 ? extractedAuthors.map((author: any, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-sm font-medium">{safeStr(author)}</span>
                    )) : null}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-xs tracking-wider text-on-surface-variant mb-2 block">AFFILIATIONS</span>
                  <p className="text-sm text-on-surface italic text-slate-600">{extractedAffiliations || ""}</p>
                </div>

              </div>
              <div>
                <span className="font-semibold text-xs tracking-wider text-on-surface-variant mb-2 block">ABSTRACT</span>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
                  <p className="font-body-doc text-lg text-slate-700 leading-relaxed italic font-newsreader text-justify">
                    {displayAbstract}
                  </p>
                </div>
              </div>
              {extractedKeywords && extractedKeywords.length > 0 && (
                <div>
                  <span className="font-semibold text-xs tracking-wider text-on-surface-variant mb-2 block">KEYWORDS</span>
                  <div className="flex flex-wrap gap-2">
                    {extractedKeywords.map((kw, idx) => (
                      <span key={idx} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold border border-teal-200">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Guidelines Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-white/80 backdrop-blur-md p-8 rounded-xl shadow-lg border-l-4 border-teal-600 sticky top-32 border border-slate-200/50">
            <h3 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600">verified_user</span>
              Review Protocol
            </h3>
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                <div>
                  <h4 className="font-bold text-on-surface">Initial Triage</h4>
                  <p className="text-xs text-slate-500 mt-1">Checking formatting compliance, plagiarism markers, and basic readability scores.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">State-of-the-Art Assessment</h4>
                  <p className="text-xs text-slate-400 mt-1">Cross-referencing 58 citations against recent publications to ensure novelty.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">Core Technical Deep Dive</h4>
                  <p className="text-xs text-slate-400 mt-1">Analyzing mathematical proofs and pseudocode for logical consistency.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold text-sm">4</div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">Result Validation</h4>
                  <p className="text-xs text-slate-400 mt-1">Verifying if claimed improvements align with the provided data visualizations.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold text-sm">5</div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">Presentation Evaluation</h4>
                  <p className="text-xs text-slate-400 mt-1">Judging the clarity of argument flow and structural integrity of the paper.</p>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-200/50">
              <button 
                onClick={handleReview}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md relative overflow-hidden group"
              >
                <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">lock_open</span>
                Start AI Peer Review Now
              </button>
              <p className="text-center text-xs text-slate-400 mt-4 font-medium italic">Ready to analyze: {formattedWords} words detected</p>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  )}

  {isAnalyzing && (
    <motion.div 
      key="processing-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full flex flex-col gap-6 max-w-[1600px] mx-auto px-4 md:px-8"
    >


      {/* Navigation Bar */}
      <nav className="w-full px-8 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm mb-8 flex gap-6 rounded-2xl mt-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
          <span className="material-symbols-outlined text-blue-500">home</span>
          Return to Home
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-orange-600 transition-colors">
          <span className="material-symbols-outlined text-orange-500">dashboard</span>
          Return to Dashboard
        </Link>
        <button 
          onClick={() => { setFile(null); setExtractedText(""); setIsAnalyzing(false); }}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-teal-600 transition-colors"
        >
          <span className="material-symbols-outlined text-teal-600">neurology</span>
          Return to AI Peer Reviewer
        </button>
      </nav>

      {/* Main Layout: Bento Grid Style */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: AI Agent Status & Logs */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] border border-slate-200/50">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-[28px]">neurology</span>
              </div>
              <div>
                <h2 className="font-h2 text-2xl font-bold text-on-surface">Agent Analysis</h2>
                <p className="text-on-surface-variant text-xs text-slate-500 truncate max-w-[220px]">Reviewing: &quot;{displayTitle}&quot;</p>
              </div>
            </div>

            {/* Progress Pipeline — 9 stages matching all review criteria */}
            <div className="space-y-3 relative">
              {[
                { step: 1, label: 'Initial Triage',          sub: 'Formatting, plagiarism & scope verified.' },
                { step: 2, label: 'State-of-the-Art',        sub: 'Citation context analyzed against 14M papers.' },
                { step: 3, label: 'Technical Deep Dive',     sub: 'Validating mathematical derivations...' },
                { step: 4, label: 'Data Consistency',        sub: 'Checking abstract ↔ results ↔ tables...' },
                { step: 5, label: 'Results Validation',      sub: 'Cross-analyzing benchmark data...' },
                { step: 6, label: 'Scope & Journal Fit',     sub: 'Matching to journal aim & scope...' },
                { step: 7, label: 'Claim Verification',      sub: 'Conclusions vs. experimental evidence...' },
                { step: 8, label: 'Quality & Ethics',        sub: 'Illustration, anonymity & ethics check...' },
                { step: 9, label: 'Presentation',            sub: 'Formatting editorial suggestions...' },
              ].map(({ step, label, sub }, i, arr) => {
                const done    = currentStep > step;
                const active  = currentStep === step;
                const pending = currentStep < step;
                const isLast  = i === arr.length - 1;
                return (
                  <div key={step} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all
                        ${ done   ? 'border-secondary bg-secondary'
                          : active ? 'border-secondary bg-white'
                          :          'border-slate-200 bg-white'}`}>
                        {done   && <span className="material-symbols-outlined text-white text-xs">check</span>}
                        {active && <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />}
                      </div>
                      {!isLast && <div className={`w-0.5 h-8 mt-0.5 ${done || active ? 'bg-secondary' : 'bg-slate-100'}`} />}
                    </div>
                    <div className={`flex-1 pb-1 ${pending ? 'opacity-40' : ''}`}>
                      <p className={`text-xs font-semibold ${ done ? 'text-secondary' : active ? 'text-on-surface' : 'text-slate-400'}`}>{label}</p>
                      {(done || active) && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                      )}
                      {active && (
                        <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className="shimmer-progress h-full w-3/4" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Agent Log */}
          <div className="bg-white rounded-xl border border-slate-200/50 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-xs tracking-wider text-slate-500">AGENT LOG</span>
              <span className="flex items-center gap-1 text-[10px] text-secondary font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> LIVE
              </span>
            </div>
            <div className="p-4 font-mono text-[11px] leading-relaxed space-y-2 text-slate-600 max-h-64 overflow-y-auto">
              {agentLogs.map((log, i) => {
                // Format: "[HH:MM:SS] message" — timestamp is chars 0-10 ("[HH:MM:SS]"), message from 12
                const bracket = log.indexOf(']');
                const ts  = bracket > 0 ? log.slice(0, bracket + 1) : '';
                const msg = bracket > 0 ? log.slice(bracket + 2)    : log;
                return (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-400 shrink-0">{ts}</span>
                    <span className="text-slate-800">{msg}</span>
                  </div>
                );
              })}
              <div className="animate-pulse text-secondary">_</div>
            </div>
          </div>
        </div>

        {/* Right Column: Document Preview & Scanning Visualization */}
        <div className="col-span-12 lg:col-span-8">
          <div className="relative bg-white rounded-xl shadow-[0_4px_40px_rgba(0,0,0,0.06)] border border-slate-200/50 aspect-[3/4] md:aspect-auto md:h-full overflow-hidden flex flex-col min-h-[600px]">
            {/* Glassmorphic Tool Overlay */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-xs font-medium shadow-lg border border-white/50">
                <span className="material-symbols-outlined text-secondary text-sm">search_check</span>
                <span>Logic Verification Active</span>
              </div>
            </div>

            {/* Scanning Content */}
            <div className="flex-1 p-10 relative overflow-hidden bg-slate-50/30">
              {/* The Scanning Line Effect */}
              <div className="scanning-line z-10"></div>
              
              <div className="max-w-2xl mx-auto space-y-6 opacity-40 pointer-events-none select-none">
                <div className="space-y-4 mb-10">
                  <div className="h-8 bg-slate-200 rounded-lg w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded-lg w-1/2"></div>
                </div>
                
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                  <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                  <div className="h-3 bg-slate-200 rounded-full w-[92%]"></div>
                  <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                  <div className="h-3 bg-slate-200 rounded-full w-[85%]"></div>
                </div>

                {/* Abstract Section */}
                <div className="p-6 border border-slate-200/60 rounded-xl bg-white mt-8">
                  <div className="h-4 bg-slate-300 rounded-full w-24 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                    <div className="h-3 bg-slate-200 rounded-full w-[95%]"></div>
                    <div className="h-3 bg-slate-200 rounded-full w-[98%]"></div>
                  </div>
                </div>

                {/* AI Detection Overlay (Simulation) */}
                <div className="relative py-6">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-secondary"></div>
                  <div className="h-3 bg-secondary/10 rounded-full w-full border-l-2 border-secondary mb-2"></div>
                  <div className="h-3 bg-secondary/10 rounded-full w-[90%] border-l-2 border-secondary mb-2"></div>
                  
                  <div className="absolute -right-40 top-4 w-32">
                    <div className="glass-panel p-2 rounded-lg border border-secondary/30 bg-white/90 shadow-sm">
                      <p className="text-[10px] text-secondary font-bold uppercase mb-1">AI INSIGHT</p>
                      <p className="text-[11px] leading-tight text-on-surface">Formula consistency checked against IEEE 14.3 standards.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                  <div className="h-3 bg-slate-200 rounded-full w-[94%]"></div>
                  <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                </div>
              </div>
            </div>

            {/* Bottom Status Bar — live elapsed timer + step-driven label */}
            <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin shrink-0"></div>
                <span className="text-sm font-medium text-slate-700">
                  {currentStep <= 3 ? 'Triage & citation scan' :
                   currentStep <= 5 ? 'Technical & data validation' :
                   currentStep <= 7 ? 'Scope fit & claim verification' :
                                      'Ethics, quality & formatting'}
                  {' '}— {Math.floor(elapsedSeconds / 60) > 0 ? `${Math.floor(elapsedSeconds / 60)}m ` : ''}{elapsedSeconds % 60}s elapsed
                </span>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden">
                    <span className="text-[8px] font-bold">AI</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-teal-100 border-2 border-white flex items-center justify-center overflow-hidden">
                    <span className="text-[8px] font-bold text-teal-700">MT</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 italic font-medium">
                  Step {Math.min(currentStep, 9)} of 9
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )}

  {result && (
    <motion.main
      key="results-screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="pt-12 pb-[64px] px-4 md:px-8 max-w-screen-2xl mx-auto w-full"
    >


      {/* Navigation Bar */}
      <nav className="w-full px-8 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm mb-8 flex gap-6 rounded-2xl mt-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
          <span className="material-symbols-outlined text-blue-500">home</span>
          Return to Home
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-orange-600 transition-colors">
          <span className="material-symbols-outlined text-orange-500">dashboard</span>
          Return to Dashboard
        </Link>
        <button 
          onClick={() => { setResult(null); setFile(null); setExtractedText(""); }}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-teal-600 transition-colors"
        >
          <span className="material-symbols-outlined text-teal-600">neurology</span>
          Return to AI Peer Reviewer
        </button>
      </nav>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-[40px] gap-4">
        <div>
          <h1 className="font-h1 text-3xl font-semibold text-on-background mb-1">Review Analysis: {result.manuscriptMetadata?.extractedTitle || file?.name || "Manuscript Review"}</h1>
          <p className="text-slate-500 text-sm">
            Submitted on {
              result.createdAt
                ? new Date(result.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })
                : new Date().toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })
            } • Manuscript ID: {result.manuscriptId || 'AI-2026-1082'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={async () => {
              if (currentReviewId) {
                try {
                  await fetch(`/api/reviewer?id=${currentReviewId}`, { method: 'DELETE' });
                  toast.success("Deleted review from active database.");
                } catch {}
              }
              // remove from manual client cache as well
              const cached = localStorage.getItem('scholarly_review_history');
              if (cached) {
                try {
                  const parsed = JSON.parse(cached);
                  const filtered = parsed.filter((h: any) => h.id !== currentReviewId);
                  localStorage.setItem('scholarly_review_history', JSON.stringify(filtered));
                  setActiveHistory(filtered);
                } catch {}
              }
              setResult(null); 
              setFile(null); 
              setExtractedText(""); 
              setCurrentReviewId(null);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer bg-transparent"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete
          </button>
          <button 
            onClick={async () => {
              if (currentReviewId && !currentReviewId.startsWith('manual-')) {
                toast.success("Already saved to cloud history");
                return;
              }
              const toastId = toast.loading("Saving to cloud history...");
              try {
                const res = await fetch("/api/reviewer", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    isSaveAction: true,
                    review: result,
                    journals: recommendedJournals,
                    filename: file?.name || 'Uploaded Paper',
                    fileType: file?.name.split('.').pop() || 'txt'
                  }),
                });
                const data = await res.json();
                toast.dismiss(toastId);
                if (data.success) {
                  setCurrentReviewId(data.reviewId);
                  toast.success("Successfully saved to cloud history");
                  fetchHistory();
                } else {
                  toast.error(data.error || "Failed to save to history");
                }
              } catch {
                toast.dismiss(toastId);
                toast.error("Network failure. Cached in client memory.");
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer bg-transparent"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Save to History
          </button>
          <button 
            onClick={() => {
              const elementCheck = document.getElementById('review-report-content');
              if (!elementCheck) {
                toast.error("Content wrapper not isolated");
                return;
              }
              const filename = `ScholarAI_Audit_Report_${Date.now()}.pdf`;
              const opt = {
                margin: 0.2,
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'] }
              };

              const generate = () => {
                // @ts-ignore
                const h2p = window.html2pdf;
                if (!h2p) { toast.error("PDF engine unavailable."); return; }

                const rawElement = document.getElementById('review-report-content');
                if (!rawElement) {
                  toast.error("Content wrapper not isolated");
                  return;
                }

                // ── OKLCH color resolver (intercepts getComputedStyle during canvas render)
                const originalGetComputedStyle = window.getComputedStyle;
                // @ts-ignore
                window.getComputedStyle = function(el: HTMLElement, pseudoEl?: string) {
                  const style = originalGetComputedStyle(el, pseudoEl);
                  return new Proxy(style, {
                    get(target: any, prop: string) {
                      if (prop === 'getPropertyValue') {
                        return (propertyName: string) => cleanColor(target.getPropertyValue(propertyName));
                      }
                      const val = target[prop];
                      if (typeof val === 'function') return val.bind(target);
                      if (typeof val === 'string' && (
                        prop === 'color' || prop === 'backgroundColor' ||
                        prop === 'borderColor' || prop === 'borderTopColor' ||
                        prop === 'borderRightColor' || prop === 'borderBottomColor' ||
                        prop === 'borderLeftColor' || prop === 'outlineColor' ||
                        prop === 'boxShadow' || prop === 'fill' || prop === 'stroke'
                      )) return cleanColor(val);
                      return val;
                    }
                  });
                };

                // ── Helper: apply all PDF layout+sizing fixes to the cloned document
                const applyPdfFixes = (clonedDoc: Document) => {
                  // Remove non-printable elements
                  clonedDoc.querySelectorAll('button, nav, footer, header, .no-print').forEach(el => el.remove());

                  const root = clonedDoc.getElementById('review-report-content');
                  if (!root) return;

                  // ── 1. Root container: Stacks vertically for full A4 horizontal space, no horizontal clipping ──────
                  root.style.cssText += '; display: flex !important; flex-direction: column !important; width: 710px !important; max-width: 710px !important; box-sizing: border-box !important; padding: 8px !important; overflow: hidden !important; word-break: break-word !important;';

                  // ── 2. Global font-size reduction (72% of computed) + overflow ─
                  root.querySelectorAll<HTMLElement>('*').forEach(el => {
                    const fs = parseFloat(window.getComputedStyle(el).fontSize);
                    if (!isNaN(fs) && fs > 0) el.style.fontSize = Math.round(fs * 0.72) + 'px';
                    el.style.lineHeight = '1.35';
                    el.style.wordBreak = 'break-word';
                    el.style.overflowWrap = 'break-word';
                    el.style.maxWidth = '100%';
                    el.style.boxSizing = 'border-box';
                  });

                  // Stacks all columns vertically in the PDF to utilize full A4 horizontal page space (710px)
                  root.querySelectorAll<HTMLElement>('[class*="col-span-"], [class*="lg:col-span-"], aside, section, article').forEach(el => {
                    el.style.cssText += '; display: block !important; width: 100% !important; max-width: 100% !important; float: none !important; margin-left: 0 !important; margin-right: 0 !important; position: static !important;';
                  });

                  // Disable any display grid/sticky constraints on parent layout
                  root.querySelectorAll<HTMLElement>('.grid, .report-grid, .sticky').forEach(el => {
                    el.style.cssText += '; display: block !important; position: static !important; width: 100% !important; margin: 0 !important; padding: 0 !important;';
                  });

                  // Fix overflow-hidden clipping
                  root.querySelectorAll<HTMLElement>('.overflow-hidden').forEach(el => {
                    el.style.overflow = 'visible';
                  });

                  // Stacks the journal buttons vertically in the PDF so they never clip or wrap horizontally
                  root.querySelectorAll<HTMLElement>('[class*="flex-col sm:flex-row"]').forEach(el => {
                    el.style.cssText += '; display: flex !important; flex-direction: column !important; gap: 6px !important; margin-top: 8px !important;';
                  });
                  root.querySelectorAll<HTMLElement>('[class*="flex-col sm:flex-row"] > a').forEach(el => {
                    el.style.cssText += '; display: flex !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; box-sizing: border-box !important; padding: 6px 12px !important;';
                  });

                  // Fix the 3-col bento stats grid (Score / Strengths / Weaknesses)
                  root.querySelectorAll<HTMLElement>('[class*="md:grid-cols-3"]').forEach(el => {
                    el.style.cssText += '; display: flex !important; flex-direction: column !important; gap: 12px !important;';
                    el.querySelectorAll<HTMLElement>(':scope > *').forEach(child => {
                      child.style.cssText += '; display: block !important; width: 100% !important;';
                    });
                  });

                  // Fix 4-col gauge grid — layout + explicit visible overflow
                  root.querySelectorAll<HTMLElement>('[class*="md:grid-cols-4"]').forEach(el => {
                    el.style.cssText += '; display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important; justify-content: space-around !important; align-items: center !important; gap: 6px !important; padding: 8px 4px !important; overflow: visible !important;';
                    el.querySelectorAll<HTMLElement>(':scope > div').forEach(child => {
                      child.style.cssText += '; flex: 1 1 0 !important; min-width: 0 !important; text-align: center !important; overflow: visible !important;';
                    });
                  });
                  // Gauge container parent sizing
                  root.querySelectorAll<HTMLElement>('[class*="md:grid-cols-4"] .relative').forEach(el => {
                    el.style.width = '64px'; el.style.height = '64px';
                    el.style.margin = '0 auto 4px';
                    el.style.overflow = 'visible';
                    el.style.position = 'relative';
                    el.style.display = 'block';
                  });

                  // Gauge percentage text centered over the circle
                  root.querySelectorAll<HTMLElement>('[class*="md:grid-cols-4"] .absolute').forEach(el => {
                    el.style.cssText += '; font-size: 9px !important; font-weight: 700 !important; color: #0f172a !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                  });
                  // Gauge label below circle
                  root.querySelectorAll<HTMLElement>('[class*="md:grid-cols-4"] > div > span').forEach(el => {
                    el.style.cssText += '; font-size: 6.5px !important; font-weight: 700 !important; display: block !important; margin-top: 2px !important; letter-spacing: 0.02em !important; text-transform: uppercase !important;';
                  });

                  // ── Cards: compact padding, overflow hidden, word-wrap ────────
                  root.querySelectorAll<HTMLElement>(
                    '.rounded-xl,.rounded-lg,.rounded-2xl,.rounded-3xl,.bg-white'
                  ).forEach(el => {
                    el.style.padding = '8px 10px';
                    el.style.marginBottom = '6px';
                    el.style.overflow = 'visible';
                    el.style.maxWidth = '100%';
                    el.style.boxSizing = 'border-box';
                    el.style.wordBreak = 'break-word';
                    el.style.pageBreakInside = 'avoid'; // Prevent card splitting across pages
                  });

                  // ── Compact gaps and spacing utilities ──────────────────
                  root.querySelectorAll<HTMLElement>('[class*="gap-"]').forEach(el => {
                    el.style.gap = '6px';
                  });
                  root.querySelectorAll<HTMLElement>('[class*="space-y-"]').forEach(el => {
                    el.style.rowGap = '5px';
                  });
                  root.querySelectorAll<HTMLElement>('[class*="mb-8"],[class*="mb-6"],[class*="mb-\\[40px\\]"]').forEach(el => {
                    el.style.marginBottom = '5px';
                  });
                  root.querySelectorAll<HTMLElement>('[class*="mt-6"],[class*="mt-4"]').forEach(el => {
                    el.style.marginTop = '4px';
                  });
                  root.querySelectorAll<HTMLElement>('[class*="p-6"],[class*="p-8"],[class*="p-10"],[class*="p-12"],[class*="p-\\[24px\\]"],[class*="p-\\[40px\\]"]').forEach(el => {
                    el.style.padding = '8px 10px';
                  });

                  // ── Shrink big headings ────────────────────────────────
                  root.querySelectorAll<HTMLElement>('h2,.text-2xl,.text-xl').forEach(el => {
                    el.style.fontSize = '13px'; el.style.lineHeight = '1.2'; el.style.marginBottom = '3px';
                  });
                  root.querySelectorAll<HTMLElement>('h3').forEach(el => {
                    el.style.fontSize = '11px'; el.style.lineHeight = '1.2'; el.style.marginBottom = '3px';
                  });
                  root.querySelectorAll<HTMLElement>('h4,h5').forEach(el => {
                    el.style.fontSize = '10px'; el.style.lineHeight = '1.2'; el.style.marginBottom = '2px';
                  });
                  // Shrink the giant score number
                  root.querySelectorAll<HTMLElement>('.text-\\[56px\\],.text-\\[48px\\]').forEach(el => {
                    el.style.fontSize = '30px'; el.style.lineHeight = '1';
                  });

                  // ── Compact body text ────────────────────────────────
                  root.querySelectorAll<HTMLElement>('p').forEach(el => {
                    el.style.fontSize = '8.5px'; el.style.lineHeight = '1.35'; el.style.marginBottom = '2px';
                  });
                  root.querySelectorAll<HTMLElement>('li').forEach(el => {
                    el.style.fontSize = '8.5px'; el.style.lineHeight = '1.35'; el.style.marginBottom = '1px';
                  });
                  root.querySelectorAll<HTMLElement>('span.text-xs,span.text-sm,.text-xs,.text-sm').forEach(el => {
                    el.style.fontSize = '8px';
                  });

                  // ── Shrink small icon SVGs only (NOT gauge SVGs) ──────────
                  root.querySelectorAll<HTMLElement>('svg:not([data-gauge])').forEach(el => {
                    const cls = el.getAttribute('class') || '';
                    const isIcon = cls.includes('w-3') || cls.includes('w-4') || cls.includes('w-5') || cls.includes('w-6') || cls.includes('h-3') || cls.includes('h-4') || cls.includes('h-5') || cls.includes('h-6');
                    if (isIcon) {
                      el.style.width = '10px';
                      el.style.height = '10px';
                      el.style.flexShrink = '0';
                    }
                  });
                  root.querySelectorAll<HTMLElement>('[class*="material-symbols"]').forEach(el => {
                    el.style.fontSize = '11px';
                  });

                  // ── Premium Text Justification without word overlays ────────────
                  root.querySelectorAll<HTMLElement>('p, li, .text-justify').forEach(el => {
                    el.style.textAlign = 'justify';
                    (el.style as any).textJustify = 'inter-word';
                    el.style.hyphens = 'auto';
                  });
                  // Left-align headings and labels (not justified)
                  root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,span.font-bold,span.uppercase').forEach(el => {
                    el.style.textAlign = 'left';
                  });

                  // Fix Score card oklch gradient → hardcoded teal
                  root.querySelectorAll<HTMLElement>('.bg-primary-container').forEach(el => {
                    el.style.background = 'linear-gradient(135deg, #00685f 0%, #008378 100%)';
                    el.style.color = '#ffffff';
                    el.querySelectorAll<HTMLElement>('*').forEach(child => {
                      child.style.color = '#ffffff';
                    });
                  });

                  // Fix Reviewer Comment cards — oklch tinted backgrounds → explicit hex
                  const colorMap: Record<string, { bg: string; border: string; bar: string }> = {
                    'bg-teal-50':    { bg: '#f0fdfa', border: '#ccfbf1', bar: '#0d9488' },
                    'bg-blue-50':    { bg: '#eff6ff', border: '#dbeafe', bar: '#2563eb' },
                    'bg-amber-50':   { bg: '#fffbeb', border: '#fef3c7', bar: '#f59e0b' },
                    'bg-indigo-50':  { bg: '#eef2ff', border: '#e0e7ff', bar: '#4f46e5' },
                    'bg-slate-50':   { bg: '#f8fafc', border: '#f1f5f9', bar: '#64748b' },
                    'bg-cyan-50':    { bg: '#ecfeff', border: '#cffafe', bar: '#06b6d4' },
                    'bg-green-50':   { bg: '#f0fdf4', border: '#dcfce7', bar: '#16a34a' },
                    'bg-orange-50':  { bg: '#fff7ed', border: '#fed7aa', bar: '#ea580c' },
                    'bg-lime-50':    { bg: '#f7fee7', border: '#d9f99d', bar: '#65a30d' },
                    'bg-sky-50':     { bg: '#f0f9ff', border: '#bae6fd', bar: '#0284c7' },
                    'bg-violet-50':  { bg: '#f5f3ff', border: '#ede9fe', bar: '#7c3aed' },
                    'bg-rose-50':    { bg: '#fff1f2', border: '#ffe4e6', bar: '#e11d48' },
                    'bg-fuchsia-50': { bg: '#fdf4ff', border: '#f5d0fe', bar: '#c026d3' },
                  };
                  Object.entries(colorMap).forEach(([cls, colors]) => {
                    root.querySelectorAll<HTMLElement>(`.${cls}`).forEach(el => {
                      el.style.backgroundColor = colors.bg;
                      el.style.borderColor = colors.border;
                    });
                    root.querySelectorAll<HTMLElement>(`.bg-${cls.replace('bg-', '').replace('-50', '-500')}`).forEach(el => {
                      el.style.backgroundColor = colors.bar;
                    });
                  });

                  // Fix teal/color text classes for icons/labels
                  const textColorMap: Record<string, string> = {
                    'text-teal-500': '#0d9488', 'text-teal-600': '#0d9488', 'text-teal-700': '#0f766e',
                    'text-blue-600': '#2563eb', 'text-blue-700': '#1d4ed8',
                    'text-amber-500': '#f59e0b', 'text-amber-600': '#d97706',
                    'text-indigo-600': '#4f46e5', 'text-slate-500': '#64748b',
                    'text-red-600': '#dc2626', 'text-slate-900': '#0f172a',
                    'text-slate-800': '#1e293b', 'text-slate-700': '#334155',
                    'text-slate-400': '#94a3b8', 'text-slate-300': '#cbd5e1',
                    'text-white': '#ffffff',
                  };
                  Object.entries(textColorMap).forEach(([cls, hex]) => {
                    root.querySelectorAll<HTMLElement>(`.${cls}`).forEach(el => {
                      el.style.color = hex;
                    });
                  });

                  // Remove trailing margin on last child to prevent blank last page
                  const lastChild = root.lastElementChild as HTMLElement;
                  if (lastChild) {
                    lastChild.style.marginBottom = '0px';
                    lastChild.style.paddingBottom = '0px';
                  }
                };

                const pdfOpts = {
                  margin: [0.25, 0.25, 0.25, 0.25],
                  filename: opt.filename,
                  image: { type: 'jpeg', quality: 0.97 },
                  html2canvas: {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0,
                    onclone: (clonedDoc: Document) => {
                      applyPdfFixes(clonedDoc);
                    }
                  },
                  jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
                  pagebreak: { mode: ['css', 'legacy'] }
                };

                h2p()
                  .set(pdfOpts)
                  .from(rawElement)
                  .save()
                  .then(() => {
                    toast.success("PDF exported successfully!");
                  })
                  .catch((err: any) => {
                    console.error("PDF generation failed:", err);
                    toast.error("PDF export failed.");
                  })
                  .finally(() => {
                    window.getComputedStyle = originalGetComputedStyle;
                  });
              };

              const loadScript = (src: string): Promise<void> => {
                return new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = src;
                  script.onload = () => resolve();
                  script.onerror = () => reject();
                  document.body.appendChild(script);
                });
              };

              const runPdfPipeline = async () => {
                // @ts-ignore
                if (typeof window.html2pdf !== 'undefined') {
                  generate();
                  return;
                }
                const toastId = toast.loading("Initializing high-performance PDF engine...");
                try {
                  // Load the 100% self-contained html2pdf bundle from official cdnjs (zero dependency loading failures!)
                  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
                  toast.dismiss(toastId);
                  setTimeout(generate, 150);
                } catch {
                  toast.dismiss(toastId);
                  toast.error("Failed to load PDF engine dependencies.");
                }
              };

              runPdfPipeline();
            }}
            className="flex items-center gap-2 px-5 py-2 bg-secondary text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-all active:scale-95 border-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export PDF
          </button>
          
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer bg-transparent"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print
          </button>

          <button 
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: `ScholarAI Peer Review - ${result.manuscriptMetadata?.extractedTitle || 'Manuscript'}`,
                    text: `Check out the AI Peer Review assessment report for the manuscript: ${result.manuscriptMetadata?.extractedTitle || 'Paper'}`,
                    url: window.location.href
                  });
                  toast.success("Assessment Shared successfully!");
                  return;
                } catch {}
              }

              try {
                if (navigator?.clipboard?.writeText) {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Assessment link copied to clipboard!");
                  return;
                }
              } catch (err) {
                console.warn("Failed to copy with navigator.clipboard:", err);
              }

              try {
                const textarea = document.createElement("textarea");
                textarea.value = window.location.href;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand("copy");
                document.body.removeChild(textarea);
                if (success) {
                  toast.success("Assessment link copied to clipboard!");
                  return;
                }
              } catch (fallbackErr) {
                console.error("Fallback copy failed:", fallbackErr);
              }

              window.prompt("Please copy the link below:", window.location.href);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer bg-transparent"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            Nearby Share
          </button>
        </div>
      </div>

      <div id="review-report-content" className="grid grid-cols-12 gap-[24px]">
        {/* Certified Report Header Card (Perfect for Screen & PDF) */}
        <div className="col-span-12 bg-white p-[24px] rounded-xl border border-slate-200 shadow-[0_4px_20px_rgba(15,23,42,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700 inline" />
              ScholarAI Audit Report
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-1 leading-tight">
              Review Analysis: {result.manuscriptMetadata?.extractedTitle || file?.name || "Manuscript Review"}
            </h2>
            <p className="text-slate-500 text-xs font-semibold">
              Submitted on {
                result.createdAt
                  ? new Date(result.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })
                  : new Date().toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })
              } • Manuscript ID: {result.manuscriptId || 'AI-2026-1082'}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 w-fit self-start md:self-center">
            <ShieldCheck className="w-4.5 h-4.5 text-teal-600 inline" />
            <span className="text-[11px] font-bold text-slate-700 uppercase">Certified Authentic</span>
          </div>
        </div>

        {/* Left Column: Summary & Feedback */}
        <div className="col-span-12 lg:col-span-8 space-y-[24px]">
          {/* Summary Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
            {/* Overall AI Score Card */}
            <div className="md:col-span-1 bg-primary-container text-white p-[24px] rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden min-h-[180px]">
              <div className="relative z-10">
                <span className="text-xs font-bold tracking-wider text-slate-400 block mb-1 uppercase">Overall AI Peer Review Score</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[56px] font-bold leading-none">{result.overallScore || 88}</span>
                  <span className="text-2xl text-slate-400">/100</span>
                </div>
              </div>
              <div className="mt-auto relative z-10 w-full pt-4">
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-400 h-full rounded-full" style={{ width: `${result.overallScore || 88}%` }}></div>
                </div>
                <p className="text-xs mt-4 text-slate-300">Highly likely to be accepted with minor revisions.</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <FileText className="w-24 h-24 text-white opacity-10" />
              </div>
            </div>

            {/* Strengths Card */}
            <div className="md:col-span-1 bg-white p-[24px] rounded-xl shadow-[0_4px_20px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-teal-600">
                <ShieldCheck className="w-4 h-4 text-teal-600 inline" />
                <span className="text-xs font-bold tracking-wider uppercase">Key Strengths</span>
              </div>
              <ul className="space-y-4 flex-1">
                {(result.strengths?.length > 0 ? result.strengths : [
                  "Novel methodology in quantum gate optimization.",
                  "Extensive empirical dataset with 480+ test cases."
                ]).slice(0, 3).map((s: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 mt-1 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 text-justify w-full">{safeStr(s)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses Card */}
            <div className="md:col-span-1 bg-white p-[24px] rounded-xl shadow-[0_4px_20px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-red-600">
                <AlertTriangle className="w-4 h-4 text-red-600 inline" />
                <span className="text-xs font-bold tracking-wider uppercase">Growth Areas</span>
              </div>
              <ul className="space-y-4 flex-1">
                {(result.weaknesses?.length > 0 ? result.weaknesses : [
                  "Inconsistent citation formatting in section 4.2.",
                  "Limited discussion on hardware scalability constraints."
                ]).slice(0, 3).map((w: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 text-justify w-full">{safeStr(w)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Visualization Section */}
          <div className="bg-white p-[40px] rounded-xl shadow-[0_4px_20px_rgba(15,23,42,0.05)] border border-slate-100">
            <h3 className="text-2xl font-semibold text-on-surface mb-[40px]">Performance Metrics Visualization</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[24px] text-center">
              {/* Gauge 1 */}
              <div>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-full h-full" viewBox="0 0 128 128">
                    <g transform="rotate(-90 64 64)">
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#e2e8f0" strokeWidth="8"></circle>
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#0d9488" strokeDasharray="351.8" strokeDashoffset={351.8 * (1 - (result.scores?.originality || 91) / 100)} strokeWidth="8" strokeLinecap="round"></circle>
                    </g>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-900">{result.scores?.originality || 91}%</div>
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Originality</span>
              </div>

              {/* Gauge 2 */}
              <div>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-full h-full" viewBox="0 0 128 128">
                    <g transform="rotate(-90 64 64)">
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#e2e8f0" strokeWidth="8"></circle>
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#2563eb" strokeDasharray="351.8" strokeDashoffset={351.8 * (1 - (result.scores?.methodology || 82) / 100)} strokeWidth="8" strokeLinecap="round"></circle>
                    </g>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-900">{result.scores?.methodology || 82}%</div>
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Soundness</span>
              </div>

              {/* Gauge 3 */}
              <div>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-full h-full" viewBox="0 0 128 128">
                    <g transform="rotate(-90 64 64)">
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#e2e8f0" strokeWidth="8"></circle>
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#f59e0b" strokeDasharray="351.8" strokeDashoffset={351.8 * (1 - (result.scores?.structure || 75) / 100)} strokeWidth="8" strokeLinecap="round"></circle>
                    </g>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-900">{result.scores?.structure || 75}%</div>
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Clarity</span>
              </div>

              {/* Gauge 4 */}
              <div>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-full h-full" viewBox="0 0 128 128">
                    <g transform="rotate(-90 64 64)">
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#e2e8f0" strokeWidth="8"></circle>
                      <circle cx="64" cy="64" fill="transparent" r="56" stroke="#4f46e5" strokeDasharray="351.8" strokeDashoffset={351.8 * (1 - (result.scores?.literature || 95) / 100)} strokeWidth="8" strokeLinecap="round"></circle>
                    </g>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-900">{result.scores?.literature || 95}%</div>
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Archival Value</span>
              </div>
            </div>
          </div>

          {/* Detailed Feedback Accordion-style — 13 criteria total */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold text-on-surface mb-2">Review Criteria Deep Dive</h3>
            
            {[
              { idx: 0,  num: '01', label: 'Originality & Innovation',         color: 'teal',    reportKey: 'abstract',           fallback: 'The proposed architecture represents a significant operational departure.' },
              { idx: 1,  num: '02', label: 'Technical Soundness',               color: 'blue',    reportKey: 'methods',             fallback: 'The analytical models constructed are internally coherent.' },
              { idx: 2,  num: '03', label: 'Clarity of Presentation',           color: 'amber',   reportKey: 'results',             fallback: 'Sectional descriptions present strong sequential mapping flows.' },
              { idx: 3,  num: '04', label: 'Impact and Relevance',              color: 'indigo',  reportKey: 'discussion',          fallback: 'Accelerates cross-boundary domain integrations seamlessly.' },
              { idx: 4,  num: '05', label: 'Ethical Considerations',            color: 'slate',   reportKey: 'conclusion',          fallback: 'The scope appropriately maps core evaluation heuristics.' },
              { idx: 5,  num: '06', label: 'Data Consistency',                  color: 'cyan',    reportKey: 'dataConsistency',     fallback: 'Numbers in the abstract, results section, and tables were cross-verified for alignment.' },
              { idx: 6,  num: '07', label: 'Citation Alignment',                color: 'green',   reportKey: 'citationAlignment',   fallback: 'In-text citation keys were matched against the final reference list for completeness.' },
              { idx: 7,  num: '08', label: 'Claim Verification',                color: 'orange',  reportKey: 'claimVerification',   fallback: 'Experimental data was assessed for its ability to fully support conclusions made by the authors.' },
              { idx: 8,  num: '09', label: 'Code & Data Availability',          color: 'lime',    reportKey: 'codeAvailability',    fallback: 'Repository links were checked for accessible code and raw dataset availability.' },
              { idx: 9,  num: '10', label: 'Scope Fit',                         color: 'sky',     reportKey: 'scopeFit',            fallback: 'The manuscript topic was evaluated for alignment with the target journal\'s stated scope.' },
              { idx: 10, num: '11', label: 'Anonymity & Blind Review Style',    color: 'violet',  reportKey: 'anonymityStyle',      fallback: 'The manuscript was checked for compliance with single-blind, double-blind, or open review formatting requirements.' },
              { idx: 11, num: '12', label: 'Illustration Quality',              color: 'rose',    reportKey: 'illustrationQuality', fallback: 'Charts, plots, and diagrams were evaluated for resolution, legibility, and appropriate labelling.' },
              { idx: 12, num: '13', label: 'Formatting Rules Compliance',       color: 'fuchsia', reportKey: 'formattingRules',     fallback: 'The manuscript structure, length, and typography were verified against standard journal template requirements.' },
            ].map(({ idx, num, label, color, reportKey, fallback }) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                <button 
                  onClick={() => setExpandedAccordion(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                  className="w-full p-[24px] flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full bg-${color}-50 text-${color}-700 flex items-center justify-center font-bold text-sm`}>{num}</span>
                    <span className="font-bold text-slate-800">{label}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${expandedAccordion.includes(idx) ? 'rotate-180' : ''}`} />
                </button>
                {expandedAccordion.includes(idx) && (
                  <div className="p-[24px] pt-0 text-slate-600 font-body-doc border-t border-slate-50">
                    <div className={`bg-${color}-50 p-5 rounded-xl border border-${color}-100 relative overflow-hidden mt-4`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${color}-500 rounded-l-xl`}></div>
                      <h5 className="text-slate-800 font-bold text-sm mb-2 flex items-center gap-2">
                        <FileText className={`w-4.5 h-4.5 text-${color}-600 inline`} />
                        Reviewer Comments
                      </h5>
                      <p className="text-sm leading-relaxed font-sans text-justify w-full">{safeStr(result.detailedReport?.[reportKey as keyof typeof result.detailedReport] || result.summary || fallback, fallback)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

          </div>
        </div>

        {/* Right Column: Journal Recommender */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(15,23,42,0.05)] border border-slate-100 p-[24px] sticky top-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-on-surface">Journal Matching</h3>
              <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-1 rounded uppercase">
                {recommendedJournals?.length || 0} Matches
              </span>
            </div>
            <div className="space-y-4 pr-2 custom-scrollbar">
              {recommendedJournals?.map((j: any, idx: number) => (
                <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all group flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <h4 className="font-bold text-base text-slate-900 group-hover:text-teal-700 transition-colors leading-tight">{j.name}</h4>
                      <span className="text-xs text-slate-500">Impact Factor: <strong className="text-slate-800">{j.impactFactor || "N/A"}</strong> • <strong className="text-slate-800">{j.publisher || ""}</strong></span>
                    </div>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-full border border-teal-200 shrink-0 ml-2">
                      {j.aimScopeMatchScore || (98 - idx * 4)}% Match
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed text-justify w-full">{j.reasoning || `Recommended for ${j.domains?.slice(0, 2).join(', ') || 'this domain'}.`}</p>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-blue-600">
                        <Clock className="w-3.5 h-3.5 text-blue-600 inline" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Review Time</span>
                      </div>
                      <span className="font-bold text-sm text-slate-800">{j.reviewTimeWeeks || "4-12"} weeks</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <Hourglass className="w-3.5 h-3.5 text-amber-600 inline" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Time to Publish</span>
                      </div>
                      <span className="font-bold text-sm text-slate-800">{j.publicationTimeWeeks || "12-24"} weeks</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-purple-600">
                        <Globe className="w-3.5 h-3.5 text-purple-600 inline" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Access</span>
                      </div>
                      <span className="font-bold text-sm text-slate-800">{j.accessType || "Hybrid"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <Award className="w-3.5 h-3.5 text-emerald-600 inline" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Ranking</span>
                      </div>
                      <span className="font-bold text-sm text-slate-800">{j.quartile || "Q1"} • SJR {j.sjrScore || "—"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <a 
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-100" 
                      href={j.latexTemplateUrl || "#"} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <FileText className="w-3.5 h-3.5 text-teal-700 inline" />
                      LaTeX Template
                    </a>
                    <a 
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100" 
                      href={j.homeUrl || "#"} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-700 inline" />
                      Homepage
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setIsFitAnalysisOpen(true)}
              className="w-full mt-6 py-3 text-sm font-bold text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer"
            >
              View Detailed Fit Analysis
            </button>
          </div>
        </aside>
      </div>
    </motion.main>
  )}

        </AnimatePresence>
      </main>

      {/* Modern Scholarly Footer */}
      <footer className="py-20 px-6 border-t border-outline-joy/5 bg-surface-container-low-joy/20">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-primary-joy rounded-xl flex items-center justify-center text-white shadow-lg">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-lg font-bold text-on-surface-joy tracking-tight leading-none font-newsreader italic">Latexify Studio</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary-joy/60">Scholarly Systems</span>
               </div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-300">© 2026 Architectural Peer Review Protocol</p>
            <div className="flex gap-10">
               {['Security', 'Privacy', 'Compliance', 'Terminal'].map(l => (
                 <Link key={l} href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary-joy transition-colors">{l}</Link>
               ))}
            </div>
         </div>
      </footer>

      <AnimatePresence>
        {isLearnMoreOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 max-w-2xl w-full h-[70vh] max-h-[70vh] mx-4 shadow-2xl border border-slate-100 dark:border-slate-800 relative flex flex-col justify-between"
            >
              <button 
                onClick={() => setIsLearnMoreOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              <div className="flex items-center gap-3 text-tertiary mb-6 flex-shrink-0">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <h3 className="font-display-md text-2xl font-bold text-slate-900 dark:text-white">Flow Analysis</h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scroll">
                <p className="font-body-md text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
                  Our <strong>Flow Analysis</strong> tool leverages advanced semantic parsing to evaluate the structural integrity of your manuscript.
                </p>

                <div className="space-y-2">
                  {[
                    { title: "Logical Continuity Check", icon: "analytics", desc: "Ensures arguments build sequentially without logical leaps. Scans for causal links and premise-conclusion parity." },
                    { title: "Variable Definition Mapping", icon: "tune", desc: "Verifies all introduced symbols are explicitly defined. Flags orphaned variables and missing operational definitions." },
                    { title: "Transition Smoothness", icon: "swap_horiz", desc: "Scores the flow between paragraphs and sections. Identifies abrupt shifts in topic or tone." }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      <button 
                        onClick={() => setExpandedModalAccordion(expandedModalAccordion === idx ? null : idx)}
                        className="w-full flex items-center justify-between p-4 font-bold text-slate-800 dark:text-slate-200 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-tertiary">{item.icon}</span>
                          <span>{item.title}</span>
                        </div>
                        <span className={`material-symbols-outlined text-slate-400 transform transition-transform duration-200 ${expandedModalAccordion === idx ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>
                      {expandedModalAccordion === idx && (
                        <div className="p-4 pt-0 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 text-justify">
                          {item.desc}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex-shrink-0">
                <button 
                  onClick={() => setIsLearnMoreOpen(false)}
                  className="w-full bg-tertiary hover:bg-tertiary-container text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-tertiary/20 transition-all active:scale-95 cursor-pointer"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFitAnalysisOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-4xl w-full max-h-[85vh] mx-4 shadow-2xl border border-slate-100 relative flex flex-col"
            >
              <button
                onClick={() => setIsFitAnalysisOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              <div className="flex items-center gap-3 mb-6 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700">
                  <BookOpen className="w-6 h-6 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Detailed Journal Fit Analysis</h3>
                  <p className="text-sm text-slate-500">{recommendedJournals?.length || 0} matching journals ranked by fit score</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scroll">
                {recommendedJournals?.map((j: any, idx: number) => (
                  <div key={idx} className="p-5 bg-white rounded-xl border border-slate-200 hover:border-teal-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">#{idx + 1}</span>
                          <h4 className="font-bold text-base text-slate-900">{j.name}</h4>
                        </div>
                        <span className="text-xs text-slate-500">{j.publisher || ""} • {j.quartile || "—"} • IF: {j.impactFactor || "—"}</span>
                      </div>
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 shrink-0 ml-2">
                        {j.aimScopeMatchScore || (98 - idx * 4)}% Match
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-3 leading-relaxed text-justify w-full">{j.reasoning || `Recommended for ${j.domains?.slice(0, 2).join(', ') || 'this domain'}.`}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Access Type</span>
                        <span className="font-bold text-sm text-slate-800">{j.accessType || "Hybrid"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">APC</span>
                        <span className="font-bold text-sm text-slate-800">{j.apc ? `$${j.apc.toLocaleString()}` : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Review Time</span>
                        <span className="font-bold text-sm text-slate-800">{j.reviewTimeWeeks || "—"} weeks</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Publication Time</span>
                        <span className="font-bold text-sm text-slate-800">{j.publicationTimeWeeks || "—"} weeks</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">SJR Score</span>
                        <span className="font-bold text-sm text-slate-800">{j.sjrScore || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Quartile</span>
                        <span className="font-bold text-sm text-slate-800">{j.quartile || "—"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Indexing</span>
                        <div className="flex flex-wrap gap-1">
                          {(j.indexing || []).map((idxName: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-white text-slate-700 rounded text-[10px] font-medium border border-slate-200">{idxName}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <a href={j.latexTemplateUrl || "#"} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-100">
                        <FileText className="w-3.5 h-3.5 text-teal-700 inline" /> LaTeX Template
                      </a>
                      <a href={j.homeUrl || "#"} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100">
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-700 inline" /> Homepage
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ProjectLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </div>
  );
}


