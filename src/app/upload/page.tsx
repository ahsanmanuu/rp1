"use client";

import { useState, useCallback, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/pb-auth-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { 
  AlertTriangle, BookOpen, FileCheck, Table, Hash, Info, Printer, 
  Share2, ShieldCheck, FileText, Download, CheckCircle2, 
  Sparkles, Sigma, Image as ImageIcon, Clock, ChevronRight,
  Trash2, Layers
} from "lucide-react";
import { TEMPLATE_REGISTRY } from "@/lib/templates/registry";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import LatexifyLogo from "@/components/LatexifyLogo";
import ProjectLimitModal from "@/components/ProjectLimitModal";
import { useProjectLimit } from "@/hooks/useProjectLimit";
import "./print.css";



import ScholarlySplashScreen from "@/components/ScholarlySplashScreen";

// Heavy Analysis & Feedback Components
const ProjectStats = dynamic(() => import("@/components/ProjectStats").then(m => m.ProjectStats), { ssr: false });
const ScholarlyAnalysisModal = dynamic(() => import("@/components/ScholarlyAnalysisModal"), { ssr: false });

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [projectData, setProjectData] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const { showLimitModal, setShowLimitModal } = useProjectLimit();

  // Fetch reports and projects
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [repRes, docRes, studioRes] = await Promise.all([
          fetch('/api/reports'),
          fetch('/api/projects?type=DOC2LATEX'),
          fetch('/api/projects?type=LATEX_STUDIO')
        ]);
        
        let fetchedReports = [];
        if (repRes.ok) {
          const data = await repRes.json();
          fetchedReports = data.reports || [];
        }
        
        let doc2latexProjects = [];
        if (docRes.ok) {
          const data = await docRes.json();
          doc2latexProjects = data.projects || [];
        }

        // Merge report_history and DOC2LATEX projects
        const fromReports = fetchedReports.map((r: any) => ({
          id: r.id,
          projectId: r.projectId || r.id,
          title: r.title || 'Untitled Report',
          createdAt: r.createdAt || r.created,
          statsJson: r.statsJson || JSON.stringify(r.stats || {}),
        }));

        const fromProjects = doc2latexProjects.map((p: any) => ({
          id: p.id,
          projectId: p.id,
          title: p.title || 'Untitled Document',
          createdAt: p.createdAt || p.updatedAt || p.created,
          statsJson: JSON.stringify(p.stats || {
            words: p.wordCount || 0,
            tables: p.tableCount || 0,
            images: p.imageCount || 0,
            equations: p.equationCount || 0,
          }),
        }));

        const byProjectId = new Map<string, any>();
        for (const item of fromProjects) {
          byProjectId.set(item.projectId, item);
        }
        for (const item of fromReports) {
          byProjectId.set(item.projectId, item);
        }

        const merged = Array.from(byProjectId.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setReports(merged);

        if (studioRes.ok) {
          const data = await studioRes.json();
          const rawProjects = data.projects || [];
          const uniqueProjects = Array.from(new Map(rawProjects.map((p: any) => [p.id, p])).values());
          setProjects(uniqueProjects);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setReportsLoading(false);
        setProjectsLoading(false);
      }
    };
    fetchData();
  }, [status, session]);

  // Fetch reports and projects

  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Load project if ID is in URL (for history clicks)
  const urlIdParam = searchParams.get('id');

  useEffect(() => {
    const loadProjectFromUrl = async () => {
      if (urlIdParam) {
        setIsHistoryLoading(true);
        try {
          const res = await fetch(`/api/projects/${urlIdParam}`);
          const data = await res.json();

          if (data.project) {
            setProjectData(data.project);
            setUploadSuccess(true);
          }
        } catch (e) {
          console.warn("Failed to load project from URL:", e);
        } finally {
          setIsHistoryLoading(false);
        }
      }
    };
    
    loadProjectFromUrl();
  }, [urlIdParam]);


  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError("");
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "text/x-tex",
      "application/x-tex"
    ];
    
    const isValidExt = /\.(docx|txt|tex|pdf|zip)$/i.test(selectedFile.name);

    if (!validTypes.includes(selectedFile.type) && !isValidExt) {
      setError("Please upload a .docx, .txt, .tex, .pdf, or .zip file.");
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("File exceeds the maximum size of 20MB.");
      return;
    }

    setFile(selectedFile);
  };

  const [analysisProgress, setAnalysisProgressState] = useState(0);
  const maxProgressRef = useRef(0);
  const delayedLoadingRef = useRef(false);

  const setAnalysisProgress = (val: number) => {
    if (val > maxProgressRef.current) {
      maxProgressRef.current = val;
      setAnalysisProgressState(val);
    }
  };

  const proceedToTemplates = async (fileToProcess?: any) => {
    const targetFile = (fileToProcess && fileToProcess.name && typeof fileToProcess.name === 'string') ? fileToProcess : file;
    if (!targetFile) return;
    setLoading(true);
    delayedLoadingRef.current = false;
    maxProgressRef.current = 0;
    setAnalysisProgressState(0);
    setError("");
    let simulatedInterval: any = null;

    // Pre-fetch templates in parallel with the upload
    const templatesPromise = fetch('/api/templates', { cache: 'no-store' })
      .then(res => res.json())
      .catch(err => {
        console.error("Template pre-fetch failed:", err);
        return { templates: [] };
      });

    try {
      const formData = new FormData();
      formData.append("file", targetFile);

      // Step 1: Upload the file — using XMLHttpRequest with real-time active server processing simulation
      let uploadData: any;
      try {
        uploadData = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/upload");
          xhr.timeout = 300000; // 5 minutes timeout for large DOCX processing
          
          let simulatedProgress = 0;

          // Start simulated progress immediately from 0 to 48% to ensure it never gets stuck at 0%
          simulatedInterval = setInterval(() => {
            if (simulatedProgress < 48) {
              simulatedProgress += (48 - simulatedProgress) * 0.05 + 0.5;
              setAnalysisProgress(Math.round(simulatedProgress));
            }
          }, 100);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
               // Upload represents the first 50% of the overall process
               const percent = Math.round((event.loaded / event.total) * 50);
               simulatedProgress = Math.max(simulatedProgress, percent);
               setAnalysisProgress(simulatedProgress);
            }
          };

          // Once the file upload completes, start simulating database and asset extraction processing (50% to 99.4%)
          xhr.upload.onload = () => {
            if (simulatedInterval) clearInterval(simulatedInterval);
            simulatedProgress = Math.max(50, simulatedProgress);
            setAnalysisProgress(simulatedProgress);

            simulatedInterval = setInterval(() => {
              simulatedProgress += (99.4 - simulatedProgress) * 0.01;
              setAnalysisProgress(Math.min(99.4, simulatedProgress));
            }, 40);
          };

          xhr.onload = () => {
            if (simulatedInterval) clearInterval(simulatedInterval);
            simulatedProgress = Math.max(99.4, simulatedProgress);
            setAnalysisProgress(simulatedProgress);

            simulatedInterval = setInterval(() => {
              simulatedProgress += (99.9 - simulatedProgress) * 0.005;
              setAnalysisProgress(Math.min(99.9, simulatedProgress));
            }, 120);

            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error("Invalid JSON response"));
              }
            } else {
              let errorMsg = `Server Error (${xhr.status}): ${xhr.statusText || "Internal Server Error"}`;
              try {
                if (xhr.responseText?.trim().startsWith('{')) {
                  const data = JSON.parse(xhr.responseText);
                  if (data?.error) errorMsg = String(data.error);
                }
              } catch { /* response was not JSON */ }
              reject(new Error(errorMsg));
            }
          };

          xhr.onerror = () => {
            if (simulatedInterval) clearInterval(simulatedInterval);
            reject(new Error("Network request failed. Please check your connection and try again."));
          };

          xhr.ontimeout = () => {
            if (simulatedInterval) clearInterval(simulatedInterval);
            reject(new Error("Analysis timeout. The server took too long to process."));
          };
          
          xhr.send(formData);
        });
      } catch (networkErr: any) {
         throw new Error(networkErr?.message ? `Network error: ${networkErr.message}` : "Network request failed.");
      }

      // Step 2: Fetch project data and await the templates promise together.
      let projRes: Response;
      let templateData: any;
      try {
        [projRes, templateData] = await Promise.all([
          fetch(`/api/projects/${uploadData.projectId}`),
          templatesPromise,
        ]);
      } catch (networkErr: any) {
        throw new Error(
          networkErr?.message
            ? `Network error during sync: ${networkErr.message}`
            : "Failed to retrieve project data. Please try again."
        );
      }

      if (!projRes.ok) {
        let errorMsg = "Synchronization with Scholarly Database failed.";
        try {
          const data = await projRes.json();
          if (data?.error) errorMsg = String(data.error);
        } catch { /* response was not JSON */ }
        throw new Error(errorMsg);
      }

      // Body is read only once
      const projDataResponse = await projRes.json();

      setCustomTemplates(templateData?.templates || []);

      if (projDataResponse?.project) {
        if (simulatedInterval) { clearInterval(simulatedInterval); simulatedInterval = null; }
        setAnalysisProgress(100);
        setProjectData(projDataResponse.project);

        // Generate report_history record when analysis completes
        (() => {
          let stats: any = {};
          let authors: any[] = [];
          let affiliations: any[] = [];
          let keywords: any[] = [];

          try {
            const parsed = typeof projDataResponse.project.structuredContent === 'string' 
              ? JSON.parse(projDataResponse.project.structuredContent || '{}')
              : (projDataResponse.project.structuredContent || {});
            
            authors = parsed.authors || [];
            affiliations = parsed.affiliations || [];
            keywords = parsed.keywords || [];
            
            const body = Array.isArray(parsed.body) ? parsed.body : [];
            const refs = Array.isArray(parsed.references) ? parsed.references : [];
            
            let bodyTableCount = 0, bodyEquationCount = 0, bodyChartCount = 0,
                bodyPseudoCount = 0, bodyFigureCount = 0;
            body.forEach((n: any) => {
              if (n.type === 'table')     bodyTableCount++;
              if (n.type === 'equation')  bodyEquationCount++;
              if (n.type === 'chart')     bodyChartCount++;
              if (n.type === 'algorithm') bodyPseudoCount++;
              if (n.type === 'figure')    bodyFigureCount++;
              if (n.type === 'figure-group' && n.images) bodyFigureCount += n.images.length;
            });

            const validRefs = refs.filter((r: any) => {
              const t = (typeof r === 'string' ? r : '').trim();
              if (t.length < 10) return false;
              const hasYear      = /\b(19|20)\d{2}\b/.test(t);
              const hasQuotes    = /["""\u201c\u201d'`']/.test(t);
              const hasRefKw     = /\b(?:vol|volume|no|issue|pp|pages|page|press|university|dept|department|journal|proceedings|proc|conf|conference|transactions|trans|ieee|acm|elsevier|springer|doi|https?|url|www|unpublished|submitted|in\s+press)\b/i.test(t);
              const hasNumPrefix = /^\[?\d+\]?[\.\-\t\s]+/.test(t);
              if (!hasYear && !hasQuotes && !hasRefKw && !hasNumPrefix) return false;
              return true;
            });

            const s = parsed.stats || {};
            stats = {
              words: projDataResponse.project.wordCount || s.wordCount || 0,
              characters: projDataResponse.project.charCount || s.charCount || 0,
              images: bodyFigureCount || s.imageCount || 0,
              charts: bodyChartCount || s.chartCount || 0,
              tables: bodyTableCount || s.tableCount || 0,
              equations: bodyEquationCount || s.equationCount || 0,
              citations: s.citationCount || projDataResponse.project.citationCount || 0,
              references: validRefs.length || s.referenceCount || projDataResponse.project.referenceCount || 0,
              pseudocode: bodyPseudoCount || s.pseudocodeCount || 0,
            };
          } catch (e) {
            console.warn("Failed to parse structuredContent for report history save", e);
          }

          // Fire-and-forget POST to save the report
          fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projDataResponse.project.id,
              title: projDataResponse.project.title,
              stats,
              authors,
              affiliations,
              keywords,
              pdfUrl: projDataResponse.project.pdfUrl || `/upload?id=${projDataResponse.project.id}&action=download`,
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data?.success && data?.report) {
              setReports(prev => {
                const filtered = prev.filter(r => r.projectId !== projDataResponse.project.id);
                return [data.report, ...filtered];
              });
            }
          })
          .catch(err => console.error("Failed to save report history:", err));
        })();

        // Keep loading=true during delay so modal stays visible covering the transition.
        // Both loading and uploadSuccess flip together after the delay,
        // preventing the default view from flashing behind the exiting modal.
        delayedLoadingRef.current = true;
        setTimeout(() => {
          setUploadSuccess(true);
          setLoading(false);
        }, 500);
      } else {
        throw new Error("Analysis completed but document record was not retrieved.");
      }
    } catch (err: any) {
      console.error("Doc2Latex Flow Exception:", err);
      if (err.message === "LIMIT_REACHED" || err.message?.includes("Free membership")) {
        setShowLimitModal(true);
        setLoading(false);
        return;
      }
      setError(err.message || "An unexpected error interrupted the analysis.");
      setLoading(false);
    } finally {
      if (simulatedInterval) {
        clearInterval(simulatedInterval);
        simulatedInterval = null;
      }
      if (!delayedLoadingRef.current) {
        setLoading(false);
      }
    }
  };

  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  // Define allTemplates combining builtins and custom
  const allTemplates = [
    ...TEMPLATE_REGISTRY.filter(t => t.category === 'Journal' || t.category === 'Conference' || t.id === 'blank'),
    ...customTemplates.map(t => ({
      id: t.id,
      label: t.name,
      icon: '✨',
      category: 'Custom',
      desc: 'User uploaded custom template',
      publisher: 'Custom',
      isCustom: true
    }))
  ];

  const [wasVerified, setWasVerified] = useState(false);

  // Cache scholarly identity to prevent flash on refresh
  useEffect(() => {
    if (status === "authenticated" && !wasVerified) {
      sessionStorage.setItem("scholarly_verified", "true");
      setWasVerified(true);
    }
  }, [status]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    
    setIsDownloading(true);
    const downloadToast = toast.loading("Synthesizing PDF Report...");
    
    const cleanup = () => {
      setIsDownloading(false);
      const frame = document.getElementById('pdf-capture-frame');
      if (frame) frame.remove();
    };

    try {
      const originalElement = document.querySelector('.report-card');
      if (!originalElement) {
        toast.error("Report content not found.", { id: downloadToast });
        cleanup();
        return;
      }

      const safeTitle = (projectData?.title || 'Manuscript').replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      const filename = `Latexify_Report_${safeTitle}.pdf`;

      const runPureCapture = async () => {
        // Load html2canvas if not present
        if (!(window as any).html2canvas) {
          await new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            const tempDefine = (window as any).define;
            (window as any).define = undefined;
            s.onload = () => {
              (window as any).define = tempDefine;
              resolve(null);
            };
            document.head.appendChild(s);
          });
        }

        // Load jsPDF if not present
        if (!(window as any).jspdf) {
          await new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            const tempDefine = (window as any).define;
            (window as any).define = undefined;
            s.onload = () => {
              (window as any).define = tempDefine;
              resolve(null);
            };
            document.head.appendChild(s);
          });
        }

        try {
          // 1. Capture as ULTRA high-res Canvas (Lossless Rendering)
          const html2canvasFn = (window as any).html2canvas?.default || (window as any).html2canvas;
          const canvas = await html2canvasFn(originalElement, {
            scale: 3, // Increased from 2 to 3 for ultra-crisp text
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 15000,
            windowWidth: (originalElement as HTMLElement).offsetWidth,
            windowHeight: (originalElement as HTMLElement).offsetHeight,
            onclone: (clonedDoc: any) => {
              const el = clonedDoc.querySelector('.report-card');
              if (el) {
                // FORCE FULL HEIGHT: Disable all scroll/max-height constraints for the capture
                el.style.height = 'auto';
                el.style.maxHeight = 'none';
                el.style.overflow = 'visible';
                
                // Also ensure all parents are visible
                let parent = el.parentElement;
                while (parent) {
                  parent.style.height = 'auto';
                  parent.style.maxHeight = 'none';
                  parent.style.overflow = 'visible';
                  parent = parent.parentElement;
                }

                const originalWidth = (originalElement as HTMLElement).offsetWidth;
                el.style.width = `${originalWidth}px`;
                el.style.minWidth = `${originalWidth}px`;
                el.style.maxWidth = `${originalWidth}px`;
                el.style.margin = '0';
                el.style.padding = '0';
                el.style.position = 'relative';

                // SEMANTIC STYLE BAKING: Deep extraction of layout tokens
                const bakeStyles = (src: HTMLElement, dest: HTMLElement) => {
                  const computed = window.getComputedStyle(src);
                  const criticalProps = [
                    'display', 'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'gap',
                    'grid-template-columns', 'grid-column', 'grid-row', 'align-items', 'justify-content',
                    'align-content', 'justify-items', 'grid-gap', 'column-gap', 'row-gap',
                    'width', 'height', 'padding', 'margin', 'font-family', 'font-size',
                    'font-weight', 'line-height', 'text-align', 'border-radius',
                    'background-color', 'color', 'border', 'border-width', 'border-style', 'border-color',
                    'position', 'top', 'left', 'right', 'bottom', 'z-index', 'opacity', 'visibility',
                    'box-sizing', 'overflow', 'text-transform', 'letter-spacing', 'vertical-align',
                    'list-style', 'white-space', 'word-break', 'box-shadow', 'transform', 'object-fit'
                  ];
                  
                  criticalProps.forEach(p => {
                    try {
                      const val = computed.getPropertyValue(p);
                      if (val && !val.includes('okl')) {
                        (dest.style as any)[p] = val;
                      } else if (val && val.includes('okl')) {
                         if (p.includes('color') || p.includes('background') || p.includes('border')) {
                            const isBackground = p.includes('background');
                            const isBorder = p.includes('border');
                            if (isBackground) dest.style.backgroundColor = '#ffffff';
                            else if (isBorder) dest.style.borderColor = '#e2e8f0';
                            else dest.style.color = '#0f172a';
                         }
                      }
                    } catch {}
                  });

                  if (src.tagName.toLowerCase() === 'img') {
                    const img = dest as HTMLImageElement;
                    img.style.display = 'block';
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                  }

                  Array.from(src.children).forEach((child, i) => {
                    if (dest.children[i]) bakeStyles(child as HTMLElement, dest.children[i] as HTMLElement);
                  });
                };

                bakeStyles(originalElement as HTMLElement, el as HTMLElement);

                const styleTags = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
                styleTags.forEach((s: any) => {
                   const text = s.textContent || "";
                   if (text.includes('okl') || text.includes('tailwind')) s.remove();
                });
                
                const style = clonedDoc.createElement('style');
                style.textContent = `
                  * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; }
                  body { background: white !important; margin: 0 !important; padding: 0 !important; font-smoothing: antialiased !important; height: auto !important; overflow: visible !important; }
                  .report-card { background: white !important; border: none !important; box-shadow: none !important; height: auto !important; overflow: visible !important; }
                  img { image-rendering: -webkit-optimize-contrast !important; }
                `;
                clonedDoc.head.appendChild(style);

                el.style.visibility = 'visible';
                el.style.opacity = '1';
                el.style.boxShadow = 'none';
              }
            }
          });

          const imgData = canvas.toDataURL('image/png');
          const jspdfModule = (window as any).jspdf;
          const jsPDFClass = jspdfModule?.jsPDF || jspdfModule?.default?.jsPDF || jspdfModule;
          const pdf = new jsPDFClass({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
          
          const pageWidth = 210;
          const pageHeight = 297;
          const margin = 12;
          const innerWidth = pageWidth - (margin * 2);
          const pageContentHeight = pageHeight - (margin * 2);
          
          const imgWidth = innerWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          let heightLeft = imgHeight;
          let yOffset = margin;

          while (heightLeft > 0) {
            pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageContentHeight;
            yOffset -= pageContentHeight;
            if (heightLeft > 0) {
              pdf.addPage();
            }
          }

          pdf.save(filename);

          
          toast.success("Report Generated!", { id: downloadToast });
          cleanup();
        } catch (err) {
          console.error("PDF Capture failed:", err);
          toast.error("Download failed.", { id: downloadToast });
          cleanup();
        }
      };


      runPureCapture();
    } catch (err) {
      console.error("Master handler failed:", err);
      toast.error("System error.", { id: downloadToast });
      cleanup();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Latexify Analysis Report - ${projectData?.title}`,
          text: `Check out the LaTeX extraction analysis for "${projectData?.title}"`,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(window.location.href);
          alert("Link copied to clipboard!");
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
          alert("Link copied to clipboard!");
          return;
        }
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
      }

      window.prompt("Please copy the link below:", window.location.href);
    }
  };

  if (status === "loading" && !wasVerified) {
    return <ScholarlySplashScreen />;
  }

  // 2. Unauthenticated state
  if (status === "unauthenticated" || (!session && !wasVerified && status !== "loading")) {
    return (
      <div style={{ height: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <div className="card glass" style={{ padding: '3rem', maxWidth: '450px', textAlign: 'center', borderRadius: '32px' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--error)' }}>
            <ShieldCheck size={40} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '1rem', color: 'var(--text-primary)' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2.5rem' }}>
            Please log in to your Scholarly account to access the Doc2Latex conversion pipeline and extraction reports.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ padding: '1rem 3rem', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', boxShadow: '0 10px 20px -5px rgba(0, 104, 95, 0.3)' }}>
            Authenticate Now
          </Link>
        </div>
      </div>
    );
  }

  if (uploadSuccess && projectData) {
    let structured: any = { authors: [], abstract: '', keywords: [] };
    try {
       structured = JSON.parse(projectData.structuredContent || '{}');
    } catch (e) {
       console.warn("Failed to parse structuredContent", e);
    }
    
    // Render success view inline below
    return (
      <div style={{ 
        minHeight: 'calc(100vh - 80px)', 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem 2rem',
        background: 'var(--background)',
        marginTop: '80px',
        position: 'relative',
        overflow: 'visible'
      }} className="print-container">
        <ScholarlyAnalysisModal isOpen={loading} progress={analysisProgress} />
        <Toaster position="top-right" reverseOrder={false} />
        
        <div className="container" style={{ maxWidth: '1400px', width: '100%' }}>
          <div className="report-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '2.5rem', alignItems: 'start' }}>
            
            {/* Left Panel: Intelligence Report */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="report-card custom-scrollbar" 
              style={{ 
                background: 'var(--strict-bg)', 
                color: 'var(--strict-text)',
                borderRadius: '24px', 
                boxShadow: '0 30px 60px -12px rgba(0,0,0,0.12)', 
                border: '1px solid var(--strict-border)',
                display: 'flex', 
                flexDirection: 'column',
                position: 'relative',
                width: '100%',
                height: 'auto'
              }}
            >
              {/* Report Header - Ultra Premium */}
               <div className="report-header-section" style={{ 
                background: 'var(--strict-bg)', 
                padding: '3rem 4rem', 
                color: 'var(--strict-text)', 
                position: 'relative',
                overflow: 'hidden',
                borderBottom: '1px solid var(--strict-border)',
                boxShadow: 'inset 0 1px 0 var(--strict-border)'
              }}>
                {/* Abstract light effects */}
                <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', opacity: 0.15, filter: 'blur(60px)' }} />
                
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ padding: '0.75rem', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--strict-border)' }}>
                        <LatexifyLogo size={48} color="var(--accent-primary)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: '0.25rem' }}>
                          Doc2LaTeX Studio
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--strict-text)', letterSpacing: '-0.02em' }}>
                          Latexify Intelligence Report
                        </div>
                      </div>
                    </div>

                    <div className="no-print" style={{ display: 'flex', gap: '0.75rem' }}>
                      <button 
                        onClick={handlePrint} 
                        className="pro-btn" 
                        style={{ 
                          background: 'var(--strict-bg)', 
                          backdropFilter: 'blur(10px)',
                          border: '1px solid var(--strict-border)', 
                          color: 'var(--strict-text)', 
                          padding: '0.6rem 1.25rem', 
                          borderRadius: '12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      >
                        <Printer size={16} /> <span>Print</span>
                      </button>
                      <button 
                        onClick={handleShare} 
                        className="pro-btn" 
                        style={{ 
                          background: 'var(--strict-bg)', 
                          backdropFilter: 'blur(10px)',
                          border: '1px solid var(--strict-border)', 
                          color: 'var(--strict-text)', 
                          padding: '0.6rem 1.25rem', 
                          borderRadius: '12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      >
                        <Share2 size={16} /> <span>Share</span>
                      </button>
                      <button 
                        onClick={handleDownloadPDF} 
                        className="pro-btn"
                        data-action="download-pdf"
                        style={{ 
                          background: 'var(--accent-primary)', 
                          color: '#fff', 
                          padding: '0.6rem 1.5rem', 
                          borderRadius: '12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          cursor: 'pointer', 
                          border: 'none', 
                          boxShadow: '0 8px 20px -4px rgba(0, 104, 95, 0.5)'
                        }}
                      >
                        <Download size={16} /> <span>Download PDF</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ maxWidth: '800px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.2em' }}>
                      Document Identity
                    </div>
                    <h1 style={{ 
                      fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.1, color: 'var(--strict-text)', margin: 0, letterSpacing: '-0.04em'
                    }}>
                      {projectData.title || "Untitled Manuscript"}
                    </h1>
                    <div style={{ marginTop: '2rem', display: 'flex', gap: '3rem', alignItems: 'center' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--strict-text)', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Analysis Date</span>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--strict-text)' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                       </div>
                       <div style={{ width: '1px', height: '30px', background: 'var(--strict-border)' }} />
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--strict-text)', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Integrity Status</span>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShieldCheck size={16} /> Verified Structure
                          </span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Body */}
              <div style={{ padding: '4rem' }}>
                <ProjectStats 
                  stats={(() => {
                    // ─── AUTHORITATIVE COUNTS from body/references arrays ───────────────
                    // These arrays are always faithfully stored in structuredContent.
                    // structured.stats is a cached snapshot that can be stale (computed
                    // with an older parser version). Always prefer live array counts.
                    const body = Array.isArray(structured.body) ? structured.body : [];
                    const refs = Array.isArray(structured.references) ? structured.references : [];

                    // Walk body once to collect all counts
                    let bodyTableCount = 0, bodyEquationCount = 0, bodyChartCount = 0,
                        bodyPseudoCount = 0, bodyFigureCount = 0;
                    body.forEach((n: any) => {
                      if (n.type === 'table')     bodyTableCount++;
                      if (n.type === 'equation')  bodyEquationCount++;
                      if (n.type === 'chart')     bodyChartCount++;
                      if (n.type === 'algorithm') bodyPseudoCount++;
                      if (n.type === 'figure')    bodyFigureCount++;
                      if (n.type === 'figure-group' && n.images) bodyFigureCount += n.images.length;
                    });

                    // ─── REFERENCE SANITIZATION ─────────────────────────────────────────
                    // Old projects may have guideline headings stored in the refs array.
                    // Apply the same validity filter as isNewReferenceStart to fix them
                    // universally without requiring a re-upload.
                    const validRefs = refs.filter((r: any) => {
                      const t = (typeof r === 'string' ? r : '').trim();
                      if (t.length < 10) return false;
                      const hasYear      = /\b(19|20)\d{2}\b/.test(t);
                      const hasQuotes    = /["""\u201c\u201d'`']/.test(t);
                      const hasRefKw     = /\b(?:vol|volume|no|issue|pp|pages|page|press|university|dept|department|journal|proceedings|proc|conf|conference|transactions|trans|ieee|acm|elsevier|springer|doi|https?|url|www|unpublished|submitted|in\s+press)\b/i.test(t);
                      const hasNumPrefix = /^\[?\d+\]?[\.\-\t\s]+/.test(t);
                      if (!hasYear && !hasQuotes && !hasRefKw && !hasNumPrefix) return false;
                      if (/^references?\s+(?:within|in\s+the|at\s+the|inside|outside)\b/i.test(t)) return false;
                      if (/\b(?:write|ensure|use|should|must|following|include|format|align|enclose|cite|citation\s+number)\b/i.test(t) && !hasNumPrefix) return false;
                      return true;
                    });

                    // For each metric: use live body/refs count if > 0, else fall back to
                    // stored stats snapshot, then DB column, then 0.
                    const s = structured.stats || {};
                    return {
                      wordCount:       projectData.wordCount       || s.wordCount       || 0,
                      charCount:       projectData.charCount       || s.charCount       || 0,
                      // Images: DB file list is most accurate (actual saved assets)
                      imageCount:      (projectData.files?.filter((f: any) => f.fileType === 'image' && !/rf_chart/i.test(f.filename)).length)
                                       || bodyFigureCount || s.imageCount || 0,
                      chartCount:      bodyChartCount      || s.chartCount      || 0,
                      tableCount:      bodyTableCount      || s.tableCount      || 0,
                      equationCount:   bodyEquationCount   || s.equationCount   || 0,
                      citationCount:   s.citationCount     || projectData.citationCount || 0,
                      // Use sanitized refs — accurate for both new and old projects
                      referenceCount:  validRefs.length    || s.referenceCount  || projectData.referenceCount || 0,
                      pseudocodeCount: bodyPseudoCount     || s.pseudocodeCount || 0,
                    };
                  })()}
                  metadata={{
                    title: projectData.title,
                    authors: structured.authors,
                    abstract: structured.abstract || structured.summary || "",
                    keywords: structured.keywords,
                    structuredContent: projectData.structuredContent
                  }}
                />

                {/* Visual Discovery Section */}
                <div style={{ marginTop: '5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon size={20} aria-hidden="true" />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--sub-heading)', margin: 0, letterSpacing: '-0.02em' }}>Visual Asset Discovery</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', margin: 0 }}>High-fidelity extractions from manuscript</p>
                    </div>
                  </div>
                  
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    {(() => {
                      // Build set of image filenames referenced in the body so orphaned extras are excluded
                      const bodyImageNames = new Set<string>();
                      if (Array.isArray(structured?.body)) {
                        structured.body.forEach((n: any) => {
                          if (n.type === 'figure-group' && n.images) {
                            n.images.forEach((img: any) => { if (img.src) bodyImageNames.add(img.src); });
                          } else if ((n.type === 'figure' || n.type === 'image') && n.id) {
                            bodyImageNames.add(n.id);
                          } else if (n.type === 'chart' && n.id) {
                            bodyImageNames.add(n.id);
                          }
                        });
                      }
                      return Array.from(
                        new Map(
                          (projectData.files?.filter((f: any) => f.fileType === 'image') || [])
                            .filter((f: any) => bodyImageNames.has(f.filename))
                            .map((img: any) => [img.filename, img])
                        ).values()
                      );
                    })().map((img: any) => (
                      <motion.div 
                        key={img.id}
                        whileHover={{ y: -5, scale: 1.02 }}
                        className="discovery-item"
                        style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '24px', border: '1px solid var(--card-border)', cursor: 'zoom-in', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      >
                        <div style={{ height: '180px', background: '#000', borderRadius: '16px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: 'inset 0 0 40px rgba(255,255,255,0.05)', position: 'relative' }}>
                          <Image src={img.filePath} alt={img.filename} fill sizes="220px" style={{ objectFit: 'contain' }} />
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--disclaimer-text)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {img.filename}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>


                {/* Disclaimers */}
                <div style={{ marginTop: '6rem', padding: '3rem', background: 'var(--disclaimer-bg)', borderRadius: '32px', border: '1px solid var(--card-border)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '1.5rem', right: '2rem', opacity: 0.05 }}>
                    <LatexifyLogo size={120} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--sub-heading)', color: 'var(--report-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Info size={18} />
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, color: 'var(--sub-heading)' }}>Analysis Compliance</h4>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '1.25rem' }}>
                        <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: 0 }}><strong>Machine-Generated Analysis:</strong> This is an AI-driven structural report. Final LaTeX verification is mandatory.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '1.25rem' }}>
                        <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: 0 }}><strong>Structural Integrity:</strong> Elements are mapped based on academic heuristics and layout parsing.</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '1.25rem' }}>
                        <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: 0 }}><strong>Non-Legal Document:</strong> This report is for research support only and carries no legal weight.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '1.25rem' }}>
                        <ShieldCheck size={18} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: 0 }}><strong>Scholarly Rights:</strong> Extracted data remains the intellectual property of the Lead Investigator.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Panel: Template Sidebar */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              className="template-sidebar no-print" 
              style={{ position: 'sticky', top: '112px' }}
            >
              <div className="card glass-card" style={{ padding: '1.5rem', borderRadius: '32px', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 160px)', background: 'var(--report-bg)', border: '1px solid var(--card-border)', backdropFilter: 'blur(10px)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <div style={{ width: '50px', height: '50px', background: 'var(--accent-primary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#fff', boxShadow: '0 8px 20px -4px rgba(0, 104, 95, 0.3)' }}>
                    <Sparkles size={24} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--report-text)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Select Template</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', fontWeight: 500 }}>Target your extraction to a specific journal or conference format.</p>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ 
                      background: 'rgba(239, 68, 68, 0.08)', 
                      border: '1px solid var(--error)', 
                      color: 'var(--error)', 
                      padding: '0.75rem 1rem', 
                      borderRadius: '16px', 
                      fontSize: '0.8rem', 
                      fontWeight: 600, 
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                  </motion.div>
                )}
                
                <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {allTemplates.map(tpl => (
                    <TemplateCard 
                      key={tpl.id}
                      id={tpl.id} 
                      name={tpl.label} 
                      desc={tpl.desc} 
                      projectId={projectData.id} 
                      router={router} 
                      onError={setError}
                      isCustom={tpl.isCustom}
                      projectData={projectData}
                      onDelete={() => {
                         fetch('/api/templates', { cache: 'no-store' })
                           .then(res => res.json())
                           .then(data => setCustomTemplates(data.templates || []));
                      }}
                    />
                  ))}
                </div>
                
                <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--card-border)', textAlign: 'center' }}>
                  <Link href={`/doc2latex/${projectData.id}`} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', 
                    fontSize: '0.95rem', color: 'var(--accent-primary)', fontWeight: 800, textDecoration: 'none', transition: 'all 0.2s'
                  }}>
                    Skip to Professional Editor <Download size={18} />
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
  );
  }

  return (
    <div 
      className="upload-dashboard-container"
      style={{ 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 0 5rem 0',
        background: 'var(--app-bg)',
        marginTop: '80px',
        position: 'relative'
      }}
    >
      <ScholarlyAnalysisModal isOpen={loading} progress={analysisProgress} />

      {/* Silent History Loader */}
      <AnimatePresence>
        {isHistoryLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'var(--background)',
              opacity: 0.95,
              backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '1.5rem'
            }}
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              style={{ width: '40px', height: '40px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}
            />
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--report-text)', letterSpacing: '0.05em' }}>
              RETRIEVING REPORT...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* High-fidelity ambient blurs */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full blur-[150px] pointer-events-none animate-pulse opacity-50" style={{ transform: 'translate(30%, -30%)', background: 'rgba(0, 104, 95, 0.1)' }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none animate-pulse opacity-40" style={{ transform: 'translate(-20%, 20%)', animationDelay: '2s', background: 'rgba(0, 104, 95, 0.1)' }} />
      
      {/* Premium Gradient Overlay */}
      <div className="absolute inset-0 pointer-events-none" 
        style={{ 
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 104, 95, 0.05) 0%, transparent 80%)' 
        }} 
      />

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
        style={{ 
          backgroundImage: `radial-gradient(var(--accent-primary) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} 
      />


      
      <div className="container" style={{ 
        maxWidth: '1200px', 
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
        padding: '2rem 1rem'
      }}>
        
        {/* Modern Interactive History Hub */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ marginBottom: '3rem' }}
        >
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', 
            gap: '2rem' 
          }}>
            {/* Analysis Reports Column */}
            <div className="card glass-card" style={{ 
              padding: '2rem', borderRadius: '32px', 
              border: '1px solid var(--card-border)',
              background: 'var(--report-bg)',
              boxShadow: '0 20px 50px -12px rgba(0,0,0,0.08)',
              display: 'flex', flexDirection: 'column', gap: '1.5rem',
              minHeight: '400px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '48px', height: '48px', 
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0d9488 100%)', 
                    borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', boxShadow: '0 8px 16px -4px rgba(0, 104, 95, 0.4)'
                  }}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--report-text)', margin: 0 }}>Intelligence Reports</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted-text)', margin: 0, fontWeight: 600 }}>Most recent structural audits</p>
                  </div>
                </div>
                <Link href="/history?tab=DOC2LATEX" className="pro-link" style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Archive <ChevronRight size={14} />
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                {reportsLoading ? (
                  [1, 2, 3].map(i => <div key={i} style={{ height: '80px', borderRadius: '20px', background: 'var(--card-bg)', animation: 'pulse 2s infinite' }} />)
                ) : reports.length > 0 ? (
                  reports.slice(0, 5).map(r => (
                    <PremiumHistoryCard 
                      key={r.id} 
                      title={r.title} 
                      date={r.createdAt} 
                      stats={JSON.parse(r.statsJson || '{}')} 
                      type="report"
                      onClick={() => router.push(`/upload?id=${r.projectId}`)}
                      projectId={r.id}
                      onDeleted={(id: string) => setReports(prev => prev.filter(x => x.id !== id))}
                    />
                  ))
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.03)', borderRadius: '24px', marginBottom: '1rem' }}>
                      <FileText size={40} color="var(--muted-text)" />
                    </div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-text)' }}>No analysis reports yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* LaTeX Manuscripts Column */}
            <div className="card glass-card" style={{ 
              padding: '2rem', borderRadius: '32px', 
              border: '1px solid var(--card-border)',
              background: 'var(--report-bg)',
              boxShadow: '0 20px 50px -12px rgba(0,0,0,0.08)',
              display: 'flex', flexDirection: 'column', gap: '1.5rem',
              minHeight: '400px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '48px', height: '48px', 
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                    borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.4)'
                  }}>
                    <Layers size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--report-text)', margin: 0 }}>LaTeX Manuscripts</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted-text)', margin: 0, fontWeight: 600 }}>Active production workspace</p>
                  </div>
                </div>
                <Link href="/history?tab=LATEX_STUDIO" className="pro-link" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Full History <ChevronRight size={14} />
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                {projectsLoading ? (
                  [1, 2, 3].map(i => <div key={i} style={{ height: '80px', borderRadius: '20px', background: 'var(--card-bg)', animation: 'pulse 2s infinite' }} />)
                ) : projects.length > 0 ? (
                  projects.slice(0, 5).map(p => (
                    <PremiumHistoryCard 
                      key={p.id} 
                      title={p.title} 
                      date={p.date} 
                      stats={p.stats} 
                      type="project"
                      onClick={() => router.push(`/latex-studio/${p.id}`)}
                      projectId={p.id}
                      onDeleted={(id: string) => setProjects(prev => prev.filter(x => x.id !== id))}
                    />
                  ))
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.03)', borderRadius: '24px', marginBottom: '1rem' }}>
                      <Sigma size={40} color="var(--muted-text)" />
                    </div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-text)' }}>No projects discovered</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="upload-grid">
          {/* Left Column: Upload Window */}
          <motion.div 
            className="left-column"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '2rem', background: 'var(--report-bg)', borderRadius: '24px', 
            border: '1px solid var(--card-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--rim-light), transparent)' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <div style={{ padding: '0.4rem', background: 'var(--accent-primary)', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 12px rgba(0, 104, 95, 0.2)' }}>
                  <LatexifyLogo size={26} color="#fff" />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                  Doc2LaTeX Studio
                </div>
              </div>
              <h1 style={{ 
                fontSize: '1.75rem', fontWeight: 900, margin: 0, 
                letterSpacing: '-0.04em', lineHeight: 1.1, color: 'var(--report-text)'
              }}>
                Transform Manuscript <br/>
                <span style={{ color: 'var(--accent-primary)' }}>to Professional LaTeX</span>
              </h1>
            </div>

            {/* Repositioned Execute Button */}
            <motion.button 
              whileHover={file && !loading ? { scale: 1.05, y: -2 } : {}}
              whileTap={file && !loading ? { scale: 0.95 } : {}}
              className="btn" 
              style={{ 
                padding: '1rem 2rem', 
                height: 'auto', 
                fontSize: '0.9rem', 
                borderRadius: '12px', 
                background: file ? 'var(--accent-primary)' : 'var(--card-bg)', 
                border: file ? 'none' : '1px solid var(--card-border)',
                fontWeight: 800, 
                color: file ? '#ffffff' : 'var(--muted-text)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.6rem',
                boxShadow: file ? '0 8px 25px -5px rgba(0, 104, 95, 0.4)' : 'none',
                transition: 'all 0.3s ease',
                cursor: file ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap'
              }}
              disabled={!file || loading}
              onClick={proceedToTemplates}
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Hash size={20} />
                  </motion.div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>Execute Analysis Report</span>
                </>
              )}
            </motion.button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="card" 
              style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', gap: '1rem', alignItems: 'center' }}
            >
              <AlertTriangle size={20} />
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{error}</span>
            </motion.div>
          )}

          <div 
            className="card glass-card"
            style={{
              border: isDragActive ? '2px dashed var(--accent-primary)' : '1px solid var(--card-border)',
              backgroundColor: isDragActive ? 'rgba(0, 104, 95, 0.05)' : 'var(--report-bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '2.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: '24px',
              minHeight: '220px',
              boxShadow: isDragActive 
                ? '0 30px 60px -12px rgba(0, 104, 95, 0.15)' 
                : '0 10px 30px -10px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onDragEnter={handleDragEnter} onDragOver={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={() => document.getElementById('fileUpload')?.click()}
          >
            {/* Dynamic Icon Background */}
            <div style={{ position: 'absolute', opacity: 0.03, fontSize: '12rem', fontWeight: 900, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              {file ? 'DOC' : 'UPLOAD'}
            </div>

            <input id="fileUpload" type="file" accept=".docx,.txt,.tex,.pdf,.zip" style={{ display: 'none' }} onChange={handleFileChange} />
            
            <motion.div 
              animate={isDragActive ? { scale: 1.1, rotate: [0, 5, -5, 0] } : { scale: 1 }}
              style={{ 
                fontSize: '2.5rem', marginBottom: '0.75rem', filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.1))',
                background: 'rgba(0, 104, 95, 0.05)', width: '60px', height: '60px', 
                borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              {file ? '📄' : <BookOpen size={24} style={{ color: 'var(--accent-primary)' }} />}
            </motion.div>

            {file ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--report-text)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>{file.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                  <span style={{ padding: '0.4rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>Ready</span>
                  <span style={{ color: 'var(--muted-text)', fontSize: '0.9rem', fontWeight: 600 }}>{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              </motion.div>
            ) : (
              <div style={{ maxWidth: '320px' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--report-text)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Drag & drop manuscript</p>
                <p style={{ color: 'var(--muted-text)', fontSize: '1rem', fontWeight: 500 }}>or select from your local device</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Precautionary Warning */}
            <div style={{ 
              display: 'flex', alignItems: 'start', gap: '0.75rem', 
              padding: '1.25rem', background: 'rgba(239, 68, 68, 0.05)', 
              borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.15)' 
            }}>
              <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 900, color: '#ef4444', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precaution: Machine Generated Analysis</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-text)', lineHeight: 1.5, fontWeight: 500, margin: 0 }}>
                  This analysis is AI-driven and may contain inaccuracies. For maximum precision, follow the <strong>Given Guidelines</strong>.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: 'var(--muted-text)', fontSize: '0.8rem', fontWeight: 600 }}>
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
              <span>AES-256 Encrypted Tunnel • GDPR Compliant • Single-Use Session</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Preparation Guide Tile */}
        <motion.div
          className="right-column"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
        >
           <div className="card glass-card" style={{ 
            padding: '1.5rem', borderRadius: '24px', 
            border: '1px solid var(--card-border)', 
            background: 'var(--report-bg)',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--rim-light), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '32px', height: '32px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              </div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--report-text)' }}>Preparation Guide</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { icon: <Hash size={16} />, title: "Heading Hygiene", desc: "Use standard numbering (1., 1.1)." },
                { icon: <Sigma size={16} />, title: "Math Isolation", desc: "Keep complex formulas on dedicated lines." },
                { icon: <Table size={16} />, title: "Table Integrity", desc: "Use simple grids. Avoid nested merges." },
                { icon: <ImageIcon size={16} aria-hidden="true" />, title: "Asset Labels", desc: "Prefix captions with 'Table X:'." }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.15rem', color: 'var(--report-text)' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-text)', lineHeight: 1.4, fontWeight: 500 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-text)', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
                  Our engine generates production-ready LaTeX code. Verification of equations is recommended.
                </p>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
      <ProjectLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--app-bg)' }}>
        <ScholarlySplashScreen />
      </div>
    }>
      <UploadContent />
    </Suspense>
  );
}

const TemplateCard = ({ id, name, desc, projectId, router, onError, isCustom, onDelete, projectData }: any) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const handleSelect = async () => {
    setStatus('loading');
    onError("");
    
    // 1. Save Report History first (non-blocking)
    if (projectData) {
      let stats = {};
      let authors = [];
      let affiliations = [];
      let keywords = [];

      try {
        const structured = JSON.parse(projectData.structuredContent || '{}');
        stats = structured.stats || {
          wordCount: projectData.wordCount,
          charCount: projectData.charCount,
          imageCount: projectData.imageCount,
          chartCount: projectData.chartCount,
          tableCount: projectData.tableCount,
          equationCount: projectData.equationCount,
          citationCount: projectData.citationCount,
          referenceCount: projectData.referenceCount,
          pseudocodeCount: projectData.pseudocodeCount
        };
        authors = structured.authors || [];
        affiliations = structured.organizations || [];
        keywords = structured.keywords || [];
      } catch (e) {
        console.warn("Failed to parse structured content for report saving", e);
      }

      fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: projectData.title || "Untitled Manuscript",
          stats,
          authors,
          affiliations,
          keywords,
          pdfUrl: `/uploads/projects/${projectId}/report.pdf`,
          latexUrl: `/uploads/projects/${projectId}/main.tex`,
          zipUrl: `/api/projects/${projectId}/download`
        })
      }).catch(err => {
        console.warn("Non-blocking report history tracking failed:", err);
      });
    }

    // 2. Apply template with auto-retry and self-healing fallback
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch("/api/projects/apply-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, templateId: id })
        });
        const data = await res.json().catch(() => ({}));
        
        if (res.ok && data.success) {
          setStatus('success');
          sessionStorage.setItem(`force_sync_${projectId}`, 'true');
          router.push(`/doc2latex/${projectId}`);
          return;
        } else {
          const errMsg = data?.error || `Server responded with status ${res.status}`;
          if (errMsg === 'offline' || errMsg.includes('offline') || res.status === 0) {
            lastError = new Error('offline');
            if (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 600));
              continue;
            }
          } else {
            throw new Error(errMsg);
          }
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const isOffline = msg === 'offline' || msg.includes('offline') || msg.includes('Failed to fetch') || msg.includes('autocancel');
        if (isOffline && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        if (!isOffline) break;
      }
    }

    // If we have a projectId, self-heal by navigating to doc2latex studio where local sync can resolve the state
    if (projectId) {
      console.warn("Template application encountered offline state, self-healing by redirecting to workspace...", lastError);
      setStatus('success');
      sessionStorage.setItem(`force_sync_${projectId}`, 'true');
      toast.success("Opening document in studio...");
      router.push(`/doc2latex/${projectId}`);
      return;
    }

    setStatus('error');
    const rawMsg = lastError?.message || "An error occurred while applying the template. Please try again.";
    const cleanMsg = (rawMsg === 'offline' || rawMsg.includes('offline'))
      ? "Connection temporarily offline. Please check your connection and try again."
      : rawMsg;
    onError(cleanMsg);
    toast.error(cleanMsg);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      if (res.ok && onDelete) {
        onDelete();
      } else {
        throw new Error("Failed to delete template");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete template");
    }
  };

  const btnText = status === 'loading' ? 'Applying...' : status === 'success' ? 'Ready!' : status === 'error' ? 'Retry' : 'Apply';
  const btnColor = status === 'success' ? '#00c853' : status === 'error' ? 'var(--error)' : 'var(--accent-primary)';

  return (
    <motion.div 
      whileHover={{ scale: 1.02, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.2)', border: '1px solid var(--accent-primary)' }}
      whileTap={{ scale: 0.98 }}
      style={{ 
        padding: '0.85rem 1rem', 
        background: 'var(--card-bg)', 
        borderRadius: '20px', 
        border: '1px solid var(--card-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        color: 'var(--report-text)',
        minHeight: '110px'
      }}
      onClick={handleSelect}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--rim-light), transparent)' }} />
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
        <div style={{ 
          width: '36px', height: '36px', background: 'var(--accent-primary)', borderRadius: '10px', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
          boxShadow: '0 6px 12px -4px rgba(0, 104, 95, 0.3)', marginTop: '2px'
        }}>
          {isCustom ? <Sparkles size={18} /> : <FileText size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            fontSize: '0.85rem', fontWeight: 900, color: 'var(--report-text)', 
            marginBottom: '0.15rem', display: '-webkit-box', WebkitLineClamp: 2, 
            WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2',
            letterSpacing: '-0.01em'
          }}>
            {name}
          </div>
          <div style={{ 
            fontSize: '0.65rem', color: 'var(--muted-text)', fontWeight: 600, 
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', 
            overflow: 'hidden', lineHeight: '1.2', maxHeight: '2.4em', opacity: 0.8
          }}>
            {desc}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {isCustom && (
            <button onClick={handleDelete} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
               <AlertTriangle size={14} />
            </button>
          )}
        </div>
        <button 
          style={{ 
            background: btnColor, color: '#fff', border: 'none', 
            padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.75rem', 
            fontWeight: 800, transition: 'all 0.2s' 
          }}
        >
          {btnText}
        </button>
      </div>

      {status === 'loading' && (
        <motion.div 
          initial={{ left: '-100%' }}
          animate={{ left: '100%' }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: '100%', background: 'var(--accent-primary)' }}
        />
      )}
    </motion.div>
  );
};

const PremiumHistoryCard = ({ title, date, stats, type, onClick, projectId, onDeleted }: any) => {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const isReport = type === 'report';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const isReportType = type === 'report';
    if (!confirm(`Delete this ${isReportType ? 'intelligence report' : 'LaTeX project'} permanently?`)) return;
    
    setDeleting(true);
    try {
      const url = isReportType 
        ? `/api/reports/${projectId}/delete` 
        : `/api/projects/${projectId}/delete`;
        
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        toast.success(isReportType ? 'Report deleted' : 'Project deleted');
        if (onDeleted) onDeleted(projectId);
      } else {
        throw new Error('Delete failed');
      }
    } catch {
      toast.error('Could not complete deletion');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, x: 5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ 
        background: 'var(--card-bg)', 
        padding: '1.25rem', 
        borderRadius: '24px', 
        border: '1px solid var(--card-border)',
        display: 'flex', 
        alignItems: 'center', 
        gap: '1.25rem',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative Gradient Blob */}
      <div style={{ 
        position: 'absolute', top: '-20%', left: '-10%', width: '100px', height: '100px', 
        background: isReport ? 'var(--accent-primary)' : '#3b82f6', 
        filter: 'blur(40px)', opacity: 0.05, pointerEvents: 'none' 
      }} />

      {/* Icon Wrapper */}
      <div style={{ 
        width: '52px', height: '52px', borderRadius: '18px', 
        background: isReport ? 'rgba(0, 104, 95, 0.08)' : 'rgba(59, 130, 246, 0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isReport ? 'var(--accent-primary)' : '#3b82f6',
        flexShrink: 0,
        border: `1px solid ${isReport ? 'rgba(0, 104, 95, 0.1)' : 'rgba(59, 130, 246, 0.1)'}`
      }}>
        {isReport ? <FileCheck size={24} /> : <BookOpen size={24} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ 
          fontSize: '0.95rem', fontWeight: 900, color: 'var(--report-text)', 
          margin: '0 0 0.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: '-0.01em'
        }}>
          {title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-text)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={12} /> {formattedDate}
          </span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', opacity: 0.3 }} />
          <span style={{ color: isReport ? 'var(--accent-primary)' : '#3b82f6', fontWeight: 800 }}>
            {isReport ? `${stats.wordCount || 0} words` : `${stats.words || 0} words`}
          </span>
        </div>
      </div>

      {/* Action Indicators */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        {isReport && (
          <button 
            onClick={(e) => { e.stopPropagation(); router.push(`/upload?id=${projectId}&action=download`); }}
            style={{ 
              width: '32px', height: '32px', borderRadius: '10px', background: 'var(--report-bg)', 
              border: '1px solid var(--card-border)', color: 'var(--report-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}
            title="Download PDF Report"
          >
            <Download size={14} />
          </button>
        )}
        
        <button 
          onClick={handleDelete}
          disabled={deleting}
          style={{ 
            width: '32px', height: '32px', borderRadius: '10px',
            background: deleting ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.08)', 
            border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: deleting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            boxShadow: '0 4px 10px rgba(239,68,68,0.08)',
            opacity: deleting ? 0.5 : 1
          }}
          title={isReport ? "Delete Report" : "Delete Project"}
        >
          <Trash2 size={14} />
        </button>

        <div style={{ color: 'var(--muted-text)', opacity: 0.3, marginLeft: '0.2rem' }}>
          <ChevronRight size={18} />
        </div>
      </div>
    </motion.div>
  );
};


