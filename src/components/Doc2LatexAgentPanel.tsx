"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  Wand2, FileText, Layers, BookOpen, Zap
} from "lucide-react";

interface StructuralSuggestion {
  section: string;
  issue: string;
  fix: string;
}

interface LatexFix {
  description: string;
  original: string;
  replacement: string;
}

interface Doc2LatexEnhancement {
  qualityScore: number;
  verdict: string;
  abstractEnhanced: string;
  structuralSuggestions: StructuralSuggestion[];
  latexFixes: LatexFix[];
  crossRefIssues: string[];
  keywordSuggestions: string[];
  templateNotes: string;
  conversionConfidence: number;
  _partial?: boolean;
  _failSafe?: boolean;
}

interface Props {
  projectId: string;
  initialEnhancement?: Doc2LatexEnhancement | null;
  initialModel?: string;
}

const VERDICT_COLOR: Record<string, string> = {
  "Excellent":         "#10b981",
  "Good":              "#3b82f6",
  "Needs Improvement": "#f59e0b",
  "Poor":              "#ef4444",
};

const VERDICT_ICON: Record<string, React.ReactNode> = {
  "Excellent":         <CheckCircle size={16} />,
  "Good":              <CheckCircle size={16} />,
  "Needs Improvement": <AlertTriangle size={16} />,
  "Poor":              <AlertTriangle size={16} />,
};

export default function Doc2LatexAgentPanel({ projectId, initialEnhancement, initialModel }: Props) {
  const [data, setData]         = useState<Doc2LatexEnhancement | null>(initialEnhancement || null);
  const [model, setModel]       = useState<string>(initialModel || "");
  const [loading, setLoading]   = useState(!initialEnhancement);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const polledRef = useRef(false);

  // Poll /api/doc2latex-agent when no initial data is passed (async case)
  useEffect(() => {
    if (initialEnhancement || polledRef.current) return;
    polledRef.current = true;
    // The panel will show "AI Enhancement Pending" until the user triggers analysis
    setLoading(false);
  }, [initialEnhancement]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc2latex-agent?projectId=${projectId}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      // This GET just confirms availability — actual enhancement uses POST with context
      // For existing projects, show the cached result from upload response
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to fetch AI enhancement.");
      setLoading(false);
    }
  };

  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div style={{
        background: "var(--joy-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        padding: "1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles size={20} style={{ color: "var(--accent-primary)" }} />
        </motion.div>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Doc2LaTeX AI Agent running...
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        background: "var(--joy-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        padding: "1.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Wand2 size={18} style={{ color: "var(--accent-primary)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Doc2LaTeX AI Enhancement</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          AI enhancement will be available after the next upload analysis.
        </p>
        <button
          onClick={runAnalysis}
          style={{
            background: "var(--accent-primary)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Zap size={14} /> Check Agent Status
        </button>
        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>{error}</p>
        )}
      </div>
    );
  }

  const verdictColor = VERDICT_COLOR[data.verdict] || "#3b82f6";
  const scoreColor   = data.qualityScore >= 80 ? "#10b981" : data.qualityScore >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--joy-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${verdictColor}15 0%, transparent 100%)`,
        borderBottom: "1px solid var(--border-subtle)",
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: "10px",
            background: `${verdictColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: verdictColor,
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Doc2LaTeX AI Enhancement</div>
            {model && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
                via {model} {data._failSafe ? "(fail-safe)" : data._partial ? "(partial)" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Score Ring */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {data.qualityScore}
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Quality
            </div>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            background: `${verdictColor}15`,
            color: verdictColor,
            borderRadius: "999px",
            padding: "0.25rem 0.75rem",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}>
            {VERDICT_ICON[data.verdict]}
            {data.verdict}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>

        {/* Confidence bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Conversion Confidence</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{data.conversionConfidence}%</span>
          </div>
          <div style={{ height: 6, background: "var(--border-subtle)", borderRadius: 999, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.conversionConfidence}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ height: "100%", background: verdictColor, borderRadius: 999 }}
            />
          </div>
        </div>

        {/* Enhanced Abstract */}
        {data.abstractEnhanced && (
          <div>
            <button
              onClick={() => toggle("abstract")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.5rem",
                color: "var(--text-primary)", fontWeight: 600, fontSize: "0.875rem",
                padding: 0, width: "100%", textAlign: "left",
              }}
            >
              <BookOpen size={15} style={{ color: "var(--accent-primary)" }} />
              AI-Enhanced Abstract
              {expanded.abstract ? <ChevronUp size={14} style={{ marginLeft: "auto" }} /> : <ChevronDown size={14} style={{ marginLeft: "auto" }} />}
            </button>
            <AnimatePresence>
              {expanded.abstract && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    marginTop: "0.5rem",
                    padding: "0.75rem",
                    background: "var(--surface-2, rgba(0,0,0,0.04))",
                    borderRadius: "8px",
                    fontSize: "0.825rem",
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                    borderLeft: `3px solid var(--accent-primary)`,
                  }}>
                    {data.abstractEnhanced}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Structural Suggestions */}
        {data.structuralSuggestions.length > 0 && (
          <div>
            <button
              onClick={() => toggle("structural")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.5rem",
                color: "var(--text-primary)", fontWeight: 600, fontSize: "0.875rem",
                padding: 0, width: "100%", textAlign: "left",
              }}
            >
              <Layers size={15} style={{ color: "#f59e0b" }} />
              Structural Suggestions ({data.structuralSuggestions.length})
              {expanded.structural ? <ChevronUp size={14} style={{ marginLeft: "auto" }} /> : <ChevronDown size={14} style={{ marginLeft: "auto" }} />}
            </button>
            <AnimatePresence>
              {expanded.structural && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {data.structuralSuggestions.map((s, i) => (
                      <div key={i} style={{
                        padding: "0.75rem",
                        background: "#f59e0b0d",
                        border: "1px solid #f59e0b30",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                      }}>
                        <div style={{ fontWeight: 600, color: "#f59e0b", marginBottom: "2px" }}>{s.section}</div>
                        <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>{s.issue}</div>
                        <div style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: "0.75rem" }}>{s.fix}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* LaTeX Fixes */}
        {data.latexFixes.length > 0 && (
          <div>
            <button
              onClick={() => toggle("fixes")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.5rem",
                color: "var(--text-primary)", fontWeight: 600, fontSize: "0.875rem",
                padding: 0, width: "100%", textAlign: "left",
              }}
            >
              <FileText size={15} style={{ color: "#3b82f6" }} />
              LaTeX Fixes ({data.latexFixes.length})
              {expanded.fixes ? <ChevronUp size={14} style={{ marginLeft: "auto" }} /> : <ChevronDown size={14} style={{ marginLeft: "auto" }} />}
            </button>
            <AnimatePresence>
              {expanded.fixes && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {data.latexFixes.map((f, i) => (
                      <div key={i} style={{
                        padding: "0.75rem",
                        background: "#3b82f60d",
                        border: "1px solid #3b82f630",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: "4px" }}>{f.description}</div>
                        {f.original && (
                          <pre style={{ background: "#ef444420", padding: "4px 6px", borderRadius: "4px", margin: "2px 0", fontSize: "0.72rem", overflowX: "auto" }}>
                            <code style={{ color: "#ef4444" }}>- {f.original}</code>
                          </pre>
                        )}
                        {f.replacement && (
                          <pre style={{ background: "#10b98120", padding: "4px 6px", borderRadius: "4px", margin: "2px 0", fontSize: "0.72rem", overflowX: "auto" }}>
                            <code style={{ color: "#10b981" }}>+ {f.replacement}</code>
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Keywords + Template Notes */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {data.keywordSuggestions.map((kw, i) => (
            <span key={i} style={{
              background: "var(--accent-primary)15",
              color: "var(--accent-primary)",
              borderRadius: "999px",
              padding: "0.2rem 0.6rem",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}>
              {kw}
            </span>
          ))}
        </div>

        {data.templateNotes && (
          <div style={{
            fontSize: "0.78rem",
            color: "var(--text-secondary)",
            padding: "0.5rem 0.75rem",
            background: "var(--surface-2, rgba(0,0,0,0.04))",
            borderRadius: "8px",
            borderLeft: "3px solid var(--border-subtle)",
          }}>
            <strong>Template:</strong> {data.templateNotes}
          </div>
        )}
      </div>
    </motion.div>
  );
}
