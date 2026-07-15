"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "@/lib/pb-auth-react";
import { createPb } from "@/lib/pb";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { StudioFS } from "@/lib/studio-fs";
import { usePbRealtimeReports, usePbRealtimeProjects } from "@/hooks/usePbRealtime";
import { useMembershipRealtime } from "@/hooks/useMembershipRealtime";
import { useUserLocation } from "@/hooks/useUserLocation";
const ProjectStats = dynamic(() => import("@/components/ProjectStats").then(m => m.ProjectStats), { ssr: false });
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), { ssr: false });
import ProLoader from "@/components/ProLoader";
import { 
  FileText, Plus, Bell, Shield, History, 
  ChevronDown, Files, Copy,
  Home, SignalMedium, ExternalLink,
  Zap, FileEdit, Network, RefreshCw,
  Brain, Quote, Trash2, Archive, FileDown,
  Award, CheckCircle2, PlusCircle, KeyRound,
  Tag, Megaphone, X, Camera, Share2, Printer, FileArchive, Check
} from "lucide-react";
import { saveAs } from 'file-saver';

const safeParse = (str: string) => {
  try { return JSON.parse(str || "{}"); } catch { return {}; };
};

export default function DashboardPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const sessionKey = session?.user?.id || session?.user?.email || '';
  const [projects, setProjects] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [greeting, setGreeting] = useState("Good morning");

  // Dynamic membership states
  const {
    data: rawMembership,
    loading: membershipLoading,
    error: membershipError,
    refetch: refetchMembership,
  } = useMembershipRealtime({
    pollIntervalMs: 30000,
    userId: session?.user?.id,
    onMembershipChange: (prev, next) => {
      if (next !== 'free') setShowUpgradeModal(false);
    },
    onError: (err) => console.warn('[Membership] Poll error:', err),
  });
  const {
    location: userLocation,
    loading: locationLoading,
    permissionDenied,
  } = useUserLocation({
    pollIntervalMs: 30000,
    enabled: !!session?.user,
  });

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [reminderInfo, setReminderInfo] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [_rechargeLoading, setRechargeLoading] = useState(false);
  const [currencyData, setCurrencyData] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>("premium_3m");

  // PB Realtime — Intelligence Reports (report_history collection)
  const { records: pbReports, loading: reportsLoading, error: reportsError } = usePbRealtimeReports(session?.user?.id);
  // PB Realtime — All projects for the user (handles realtime count & type filtering cleanly)
  const { records: pbAllProjects, loading: projectsLoading } = usePbRealtimeProjects(session?.user?.id);

  const pbDoc2Latex = useMemo(() => pbAllProjects.filter(p => p.projectType === 'DOC2LATEX'), [pbAllProjects]);
  const pbLatexProjects = useMemo(() => pbAllProjects.filter(p => p.projectType === 'LATEX_STUDIO'), [pbAllProjects]);

  // Promotional Offers states
  const [offers, setOffers] = useState<any[]>([]);
  const [_loadingOffers, setLoadingOffers] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedOffer, setAppliedOffer] = useState<any>(null);
  const [promoError, setPromoError] = useState("");
  const [promoSuccessMessage, setPromoSuccessMessage] = useState("");

  const activeOffersList = useMemo(() => {
    const now = Date.now();
    return offers.filter(o => o.isActive && new Date(o.expiresAt).getTime() > now);
  }, [offers]);

  // Announcements states
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAnnouncements(data.announcements || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const fetchUserOffers = async () => {
    setLoadingOffers(true);
    try {
      const res = await fetch("/api/user/offers");
      if (!res.ok) {
        console.warn("Failed to fetch user offers:", res.statusText);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setOffers(data.offers || []);
      }
    } catch (err) {
      console.error("Failed to fetch user offers:", err);
    } finally {
      setLoadingOffers(false);
    }
  };

  const loadAllHistory = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const serverRes = await fetch('/api/projects');
      let serverData = { projects: [] };
      if (serverRes.ok) {
         const text = await serverRes.text();
         try {
           serverData = JSON.parse(text);
         } catch {
            console.warn('Invalid JSON from /api/projects:', text.substring(0, 50));
         }
      } else {
         console.warn('Server error fetching projects:', serverRes.status);
      }
      const serverProjects = (serverData.projects || []).map((p: any) => ({
        ...p, date: p.date || p.updatedAt, type: p.projectType || 'DOC2LATEX'
      }));

      const fs = new StudioFS(session?.user?.email || 'guest');
      const localProjects = await fs.listProjects();
      const formattedLocal = localProjects.map(p => ({
        id: p.id, title: p.title, status: 'local', date: p.updatedAt,
        type: 'LATEX_STUDIO', isLocal: true,
        stats: { words: 0, images: p.fileCount }
      }));

      const merged = [...formattedLocal, ...serverProjects].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setProjects(merged);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [session?.user?.email, setProjects, setLoading]);

  const handleApplyPromoCode = async (codeToApply?: string) => {
    const code = codeToApply || promoCodeInput;
    if (!code) {
      setPromoError("Please enter a promo code");
      setPromoSuccessMessage("");
      return;
    }

    setPromoError("");
    setPromoSuccessMessage("");
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (!res.ok) {
        setAppliedOffer(null);
        setPromoError("Internal Server Error validating promo code");
        alert("Error: Internal Server Error validating promo code");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setAppliedOffer(data.offer);
        setPromoSuccessMessage(`Promo code "${data.offer.code}" applied successfully!`);
        setPromoCodeInput("");
        // Alert user as requested
        alert(`you have selected ${data.offer.title} offer`);
      } else {
        setAppliedOffer(null);
        const errorMsg = data.message || "Invalid promo code";
        setPromoError(errorMsg);
        alert(`Promo Code Warning: ${errorMsg}`);
      }
    } catch {
      setPromoError("Failed to validate promo code");
      alert("Error: Failed to validate promo code");
    }
  };

  const handleRemovePromoCode = () => {
    setAppliedOffer(null);
    setPromoSuccessMessage("");
    setPromoError("");
  };

  const getDiscountedPrice = (planId: string): number => {
    let planBaseINR = 0;
    if (planId === 'premium_1m') planBaseINR = 250;
    else if (planId === 'premium_3m') planBaseINR = 600;
    else if (planId === 'premium_6m') planBaseINR = 1000;
    else if (planId === 'premium_12m') planBaseINR = 2200;

    const originalPrice = currencyData?.prices?.[planId] || planBaseINR;
    if (!appliedOffer || !originalPrice) return originalPrice;

    const planDetail = currencyData?.plans?.find((p: any) => p.planId === planId);
    const priceINR = planDetail ? planDetail.priceINR : planBaseINR;

    let discountINR = 0;
    if (appliedOffer.discountPercent) {
      discountINR = priceINR * (appliedOffer.discountPercent / 100);
    } else if (appliedOffer.discountAmount) {
      discountINR = appliedOffer.discountAmount;
    }

    const finalPriceINR = Math.max(0, priceINR - discountINR);

    if (currencyData && currencyData.currency !== 'INR') {
      const converted = finalPriceINR * currencyData.rateToINR;
      return currencyData.currency === 'JPY' ? Math.round(converted) : parseFloat(converted.toFixed(2));
    }
    return finalPriceINR;
  };

  const loadCurrency = useCallback(async (countryCode: string) => {
    try {
      const res = await fetch(`/api/currency/convert?country=${countryCode}`);
      if (!res.ok) {
        console.warn("Failed to load converted currency prices:", res.statusText);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCurrencyData(data);
      }
    } catch (e) {
      console.error("Failed to load converted currency prices:", e);
    }
  }, []);

  const loadCurrencyAndGeo = useCallback(async () => {
    const freeIpController = new AbortController();
    const freeIpTimeoutId = setTimeout(() => freeIpController.abort(), 3000);
    try {
      const geoRes = await fetch("https://freeipapi.com/api/json", { signal: freeIpController.signal });
      const geoData = await geoRes.json();
      if (geoData && geoData.countryCode) {
        await loadCurrency(geoData.countryCode);
        clearTimeout(freeIpTimeoutId);
        return;
      }
    } catch (e) {
      console.warn("freeipapi failed, trying ipapi.co...", e);
    } finally {
      clearTimeout(freeIpTimeoutId);
    }

    const ipapiController = new AbortController();
    const ipapiTimeoutId = setTimeout(() => ipapiController.abort(), 3000);
    try {
      const geoRes = await fetch("https://ipapi.co/json/", { signal: ipapiController.signal });
      const geoData = await geoRes.json();
      if (geoData && geoData.country_code) {
        await loadCurrency(geoData.country_code);
        clearTimeout(ipapiTimeoutId);
        return;
      }
    } catch (e) {
      console.warn("ipapi.co failed, defaulting to US...", e);
    } finally {
      clearTimeout(ipapiTimeoutId);
    }

    await loadCurrency("US");
  }, [loadCurrency]);

  const _handleRechargePoints = async (planId: string) => {
    setRechargeLoading(true);
    try {
      const res = await fetch("/api/points/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });
      if (!res.ok) {
        alert("Failed to recharge points. Server error.");
        return;
      }
      const data = await res.json();
      if (data.success) {
        alert(`Successfully recharged! Added ${data.addedPoints} points. New balance: ${data.totalPoints}`);
        refetchMembership();
      } else {
        alert(data.error || "Failed to recharge points.");
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setRechargeLoading(false);
    }
  };

  // Membership with safe defaults (never null in template, loading/error handled separately)
  const membership = useMemo(() => rawMembership ?? {
    membership: 'free',
    membershipExpiresAt: null,
    memberSince: new Date().toISOString(),
    joiningDate: new Date().toISOString(),
    totalDays: 0,
    points: 0,
    subscriptionCount: 0,
    projectsCount: 0,
    showReminder: false,
    success: false,
  } as any, [rawMembership]);

  // Sync reminderInfo from membership hook data
  useEffect(() => {
    if (rawMembership?.showReminder && rawMembership?.daysLeft && rawMembership?.expiryDate) {
      setReminderInfo({ daysLeft: rawMembership.daysLeft, expiryDate: rawMembership.expiryDate });
    }
  }, [rawMembership?.showReminder, rawMembership?.daysLeft, rawMembership?.expiryDate]);

  const initiatePayment = async (planId: string) => {
    setPaymentLoading(true);
    try {
      // Step 1: Create order server-side
      const bodyPayload: any = { planId };
      if (currencyData) {
        bodyPayload.currency = currencyData.currency;
        bodyPayload.amount = getDiscountedPrice(planId); // Send discounted price to backend order payload
      }
      if (appliedOffer) {
        bodyPayload.promoCode = appliedOffer.code;
      }
      const res = await fetch("/api/payments/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });
      if (!res.ok) {
        alert("Failed to initiate payment. Server error occurred.");
        setPaymentLoading(false);
        return;
      }
      const data = await res.json();

      if (!data.success || !data.paymentSessionId) {
        alert(data.error || "Failed to initiate payment. Please try again.");
        setPaymentLoading(false);
        return;
      }

      console.log("[PAYMENT] Order created:", data.orderId, "| Launching Cashfree SDK...");

      // Step 2: Launch Cashfree JS SDK checkout
      const { load } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await load({
        mode: (data.cashfreeEnv === "production" ? "production" : "sandbox") as "production" | "sandbox",
      });

      const checkoutOptions = {
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self" as const,
      };

      console.log("[PAYMENT] Calling cashfree.checkout()...");
      cashfree.checkout(checkoutOptions);
      // cashfree.checkout with _self will redirect — no need to setPaymentLoading(false)
    } catch (e: any) {
      console.error("[PAYMENT] Error:", e);
      alert("Payment Error: " + (e.message || "Unknown error"));
      setPaymentLoading(false);
    }
  };

  const handleSelectProject = async (p: any) => {
    setSelectedProject(p);
    setSelectedProjectDetails(null);
    if (p.isLocal) {
      setSelectedProjectDetails(p);
      return;
    }
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/projects/${p.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          setSelectedProjectDetails(data.project);
        }
      } else {
        console.error("Failed to fetch project details:", res.status);
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };
  const [connectionStatus, setConnectionStatus] = useState({ label: 'Excellent Connection', color: 'text-green-500' });
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [profilePassword, setProfilePassword] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "billing" || params.get("upgrade") === "true") {
        setShowUpgradeModal(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('user_profile_name');
      const storedImage = localStorage.getItem('user_profile_image');
      if (storedName) setProfileName(storedName);
      else if (session?.user?.name) setProfileName(session.user.name);
      if (storedImage) setProfileImage(storedImage);
    }
  }, [session]);

  useEffect(() => {
    const updateConnection = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnectionStatus({ label: 'Disconnected', color: 'text-rose-500' });
        return;
      }

      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      const conn = nav ? (nav.connection || nav.mozConnection || nav.webkitConnection) : null;

      if (conn) {
        if (conn.effectiveType === '4g' && conn.downlink >= 2) {
          setConnectionStatus({ label: 'Excellent Connection', color: 'text-green-500' });
        } else if (conn.effectiveType === '3g' || conn.effectiveType === '4g') {
          setConnectionStatus({ label: 'Good Connection', color: 'text-emerald-500' });
        } else {
          setConnectionStatus({ label: 'Poor Connection', color: 'text-amber-500' });
        }
      } else {
        setConnectionStatus({ label: 'Excellent Connection', color: 'text-green-500' });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', updateConnection);
      window.addEventListener('offline', updateConnection);
      
      const nav = navigator as any;
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      if (conn) {
        conn.addEventListener('change', updateConnection);
      }
      updateConnection();
    }

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    if (!session?.user?.email) return;
    
    // Only show loader if we have no projects loaded yet (initial load)
    const isInitialLoad = projects.length === 0;
    loadAllHistory(isInitialLoad);
    loadCurrencyAndGeo();
    fetchUserOffers();
    fetchAnnouncements();

    const pb = createPb();
    if (session?.token) {
      pb.authStore.save(session.token, null);
    }

    // ── PB Realtime Subscriptions ──
    const unsubFns: (() => void)[] = [];

    // Subscribe to announcements and offers
    pb.collection('announcements').subscribe('*', () => {
      fetchAnnouncements();
    }).then(u => unsubFns.push(u)).catch(() => {});

    pb.collection('offers').subscribe('*', () => {
      fetchUserOffers();
    }).then(u => unsubFns.push(u)).catch(() => {});

    // Subscribe to projects for the current user
    if (session?.user?.id) {
      pb.collection('projects').subscribe('*', () => {
        loadAllHistory(false);
      }, { filter: `userId = "${session.user.id}"` }).then(u => unsubFns.push(u)).catch(() => {});
    }

    // Background refresh for offers, announcements, and projects
    const bgPoll = setInterval(() => {
      fetchUserOffers();
      fetchAnnouncements();
      loadAllHistory(false);
    }, 30000);

    // Check payment redirect statuses
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get('payment');
      const upgradeTrigger = urlParams.get('upgrade');
      
      if (paymentStatus === 'success') {
        alert("Payment Successful! Your Premium membership has been activated.");
        router.replace('/dashboard');
      } else if (paymentStatus === 'failed') {
        alert("Payment Failed. Please check payment details and try again.");
        router.replace('/dashboard');
      } else if (upgradeTrigger === 'true') {
        setShowUpgradeModal(true);
      }
    }

    return () => {
      clearInterval(bgPoll);
      
      // Unsubscribe from all real-time subscriptions
      for (const fn of unsubFns) { try { fn(); } catch {} }

      if (typeof window !== 'undefined') {
        window.removeEventListener('online', updateConnection);
        window.removeEventListener('offline', updateConnection);
        const nav = navigator as any;
        const conn = nav ? (nav.connection || nav.mozConnection || nav.webkitConnection) : null;
        if (conn) conn.removeEventListener('change', updateConnection);
      }
    };
  }, [sessionKey, loadCurrencyAndGeo, router]);

  useEffect(() => {
    if (showUpgradeModal) {
      fetchUserOffers();
    }
  }, [showUpgradeModal]);

  // Merge PB realtime reports + project-based doc2latex for Intelligence Reports
  const docReports = useMemo(() => {
    const fromReports = pbReports.map(r => ({
      ...r,
      projectId: r.projectId || r.id,
      title: r.title || 'Untitled Report',
      stats: r.stats || { words: 0, images: 0 },
      date: r.date || r.createdAt,
      type: 'DOC2LATEX',
      isLocal: false,
    }));
    const fromProjects = pbDoc2Latex.map(p => ({
      ...p,
      projectId: p.id,
      title: p.title || 'Untitled Document',
      stats: p.stats || { words: p.wordCount || 0, images: p.imageCount || 0 },
      date: p.date || p.updatedAt,
      type: 'DOC2LATEX',
      isLocal: false,
    }));
    // Deduplicate by projectId.
    // Merge order: projects first (lower priority), then report_history entries
    // override (higher priority — richer metadata). Last write wins in Map.
    const byProjectId = new Map<string, any>();
    for (const item of fromProjects) {
      const key = item.projectId;
      const existing = byProjectId.get(key);
      if (!existing || new Date(item.date) > new Date(existing.date)) {
        byProjectId.set(key, item);
      }
    }
    for (const item of fromReports) {
      // report_history always overrides raw project data for same projectId
      byProjectId.set(item.projectId, item);
    }
    const unique = Array.from(byProjectId.values());
    return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [pbReports, pbDoc2Latex]);

  const latexProjects = useMemo(() => 
    pbLatexProjects.slice(0, 5),
  [pbLatexProjects]);

  const liveProjectsCount = useMemo(() => pbDoc2Latex.length + pbLatexProjects.length, [pbDoc2Latex, pbLatexProjects]);
  const displayProjectsCount = projectsLoading ? (membership.projectsCount || 0) : pbAllProjects.length;

  const handleDownloadZip = async (p: any) => {
    if (!session?.user?.email) return;
    try {
      const fs = new StudioFS(session.user.email);
      const blob = await fs.exportZip(p.id);
      saveAs(blob, `${p.title || 'manuscript'}.zip`);
    } catch (err) {
      console.error("Zip export failed:", err);
      alert("Failed to export ZIP. Please try again.");
    }
  };

  const handleShare = async (p: any) => {
    const url = `${window.location.origin}${p.type === 'DOC2LATEX' ? '/upload' : '/latex-studio'}/${p.id}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert("Project link copied to clipboard!");
        return;
      }
    } catch (err) {
      console.warn("Failed to copy with navigator.clipboard:", err);
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) {
        alert("Project link copied to clipboard!");
        return;
      }
    } catch (fallbackErr) {
      console.error("Fallback copy failed:", fallbackErr);
    }

    window.prompt("Please copy the link below:", url);
  };

  const handleDownloadPDF = (p: any) => {
    const url = p.pdfUrl || (p.type === 'DOC2LATEX' ? `/upload?id=${p.id}&action=download` : `/latex-studio/${p.id}`);
    window.open(url, '_blank');
  };

  const handleDeleteProject = async (id: string, isLocal?: boolean) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    try {
      if (isLocal) {
        const finalFs = new StudioFS(session?.user?.email || 'guest');
        await finalFs.deleteProject(id);
      } else {
        const res = await fetch(`/api/projects/${id}/delete`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete from server');
      }
      setProjects(ps => ps.filter(p => p.id !== id));
      if (selectedProject?.id === id) setSelectedProject(null);
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  const studioCategories = useMemo(() => {
    return [
      { id: 'LATEX_STUDIO', title: 'Latexify Studio', sub: 'Advanced LaTeX Editor', icon: FileEdit, color: 'text-primary', bg: 'bg-primary/10' },
      { id: 'DOC2LATEX', title: 'Doc2LateX Studio', sub: 'Word to LaTeX Converter', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
      { id: 'DIAGRAM', title: 'AI Diagram Studio', sub: 'TikZ & PGFPlots Builder', icon: Network, color: 'text-amber-500', bg: 'bg-amber-50' },
      { id: 'MIGRATOR', title: 'Template Migrator', sub: 'Convert between Journals', icon: RefreshCw, color: 'text-purple-500', bg: 'bg-purple-50' },
      { id: 'REVIEWER', title: 'AI Peer Reviewer', sub: 'Automated Pre-submission Review', icon: Brain, color: 'text-indigo-500', bg: 'bg-indigo-50' },
      { id: 'CITATIONS', title: 'AI Citation Studio', sub: 'BibTeX Manager', icon: Quote, color: 'text-rose-500', bg: 'bg-rose-50' },
    ];
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" && !_loading && !session) {
      router.replace("/login");
    }
  }, [status, _loading, session, router]);

  if (status === "loading" || _loading) {
    return <ProLoader />;
  }
  if (!session) {
    return <ProLoader />;
  }

  return (
    <div className="flex h-screen bg-background text-on-background font-body-md overflow-hidden transition-colors duration-500">
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64 h-full relative overflow-hidden">
        
        {/* Dashboard Sub-Header (Secondary Toolbar) - Fixed Overflow and Inset Icons */}
        <header className="flex-shrink-0 flex justify-between items-center h-12 px-6 pr-12 border-b border-outline bg-surface/80 backdrop-blur-md z-40 fixed top-16 right-0 left-0 md:left-64 shadow-sm">
          <div className="flex items-center gap-6">
             <nav className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                <Home size={14} />
                <span className="border-b-2 border-primary pb-0.5">Dashboard Hub</span>
             </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center text-secondary text-[10px] font-bold uppercase tracking-widest bg-surface-container-low px-4 py-1.5 rounded-full border border-outline">
              <SignalMedium className={`${connectionStatus.color} mr-2`} size={18} />
              {connectionStatus.label}
            </div>
            
            <Link 
              href="/dashboard/support" 
              className="p-1.5 text-on-surface hover:text-primary transition-colors rounded-full relative bg-surface-container-low border border-outline block"
              title="View Notifications"
            >
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white shadow-sm" />
            </Link>
            
            <div 
              onClick={() => setIsProfileOpen(true)}
              className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] ml-1 cursor-pointer overflow-hidden relative border border-outline hover:brightness-90 transition-all shadow-sm"
            >
              {profileImage ? (
                <Image fill src={profileImage} alt="Profile" className="object-cover" sizes="32px" />
              ) : (
                <span>{profileName?.[0]?.toUpperCase() || session.user?.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Canvas - PT-32 to account for double header (16+12) */}
        <main className="flex-1 overflow-y-auto p-margin academic-grid custom-scroll relative z-10 pt-32">
          <div className="max-w-7xl mx-auto space-y-lg pb-32">
            
            {/* Dynamic Greeting */}
            <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="font-h1 text-h1 text-on-surface mb-2">{greeting}, {session.user?.name?.split(' ')[0]}!</h1>
                <p className="font-body-lg text-body-lg text-secondary font-medium">Ready to research? Your academic ecosystem awaits.</p>
              </div>
            </section>

            {/* Expiry Notification Banner */}
            {reminderInfo && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-4 rounded-xl flex items-center justify-between text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Bell className="animate-bounce text-rose-500" size={16} />
                  <span>Your Premium membership expires in {reminderInfo.daysLeft} days (on {reminderInfo.expiryDate}). Renew now to maintain access.</span>
                </div>
                <button 
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-3.5 py-1.5 bg-rose-500 text-white rounded-lg text-xs hover:bg-rose-600 transition-colors shadow-sm font-bold"
                >
                  Renew Now
                </button>
              </div>
            )}

            {/* Finance & Membership Row */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
              {/* Membership Status Card - Premium Design */}
              <div className="lg:col-span-2 glass-card rounded-[2rem] p-6 lg:p-8 border border-outline hover:shadow-ambient-soft transition-all bg-surface-container-lowest/30 relative overflow-hidden">
                {/* Decorative Background Accent */}
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-[80px] pointer-events-none opacity-20" style={{ background: 'var(--accent-primary)' }} />

                {/* Loading overlay */}
                {membershipLoading && (
                  <div className="absolute inset-0 z-20 bg-surface-container-lowest/40 backdrop-blur-sm flex items-center justify-center rounded-[2rem]">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span className="text-sm font-semibold text-primary">Syncing membership...</span>
                    </div>
                  </div>
                )}

                {/* Error banner */}
                {membershipError && (
                  <div className="absolute top-4 left-4 right-4 z-20 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-500 text-[18px]">error_outline</span>
                    <span className="text-[11px] font-bold text-rose-500 flex-1">{membershipError}</span>
                    <button onClick={refetchMembership} className="text-[11px] font-black text-rose-500 uppercase tracking-wider hover:underline">Retry</button>
                  </div>
                )}
                
                <div className="relative z-10 space-y-6">
                  {/* Top Row: Plan Info + Expiry */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary border border-tertiary/20 shrink-0">
                        <Award size={22} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Membership</span>
                        <div className="text-lg font-black text-on-surface flex items-center gap-2">
                          {membership.membership === "free" ? "Free Tier" : "Premium Access"}
                          {membership.membership !== "free" && (
                            <CheckCircle2 className="text-amber-500 fill-amber-500/20 shrink-0" size={18} />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 block mb-px">Expires</span>
                      <span className="text-sm font-bold text-on-surface whitespace-nowrap">
                        {membership.membershipExpiresAt
                          ? new Date(membership.membershipExpiresAt).toLocaleDateString()
                          : "Never (Free)"}
                      </span>
                      {membership.membershipExpiresAt && (() => {
                        const diff = Math.ceil((new Date(membership.membershipExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (diff <= 0) return <span className="block text-[10px] font-bold text-rose-500 mt-0.5">Expired</span>;
                        if (diff <= 3) return <span className="block text-[10px] font-bold text-amber-500 mt-0.5">{diff}d remaining</span>;
                        return <span className="block text-[10px] font-bold text-emerald-500 mt-0.5">{diff}d remaining</span>;
                      })()}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-outline/10" />

                  {/* Projects Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Active Projects</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                        membership.membership === "free" && displayProjectsCount >= 5
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {membership.membership === "free"
                          ? `${Math.round(Math.min((displayProjectsCount / 5) * 100, 100))}% Used`
                          : "Unlimited"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2.5">
                      <span className="text-2xl font-black text-primary leading-none">{displayProjectsCount}</span>
                      <span className="text-sm font-bold text-slate-400 dark:text-slate-500 leading-none">
                        / {membership.membership === "free" ? "5" : "∞"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-900/60 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          membership.membership === "free" && displayProjectsCount >= 5
                            ? "bg-gradient-to-r from-rose-500 to-rose-600"
                            : "bg-gradient-to-r from-primary to-primary-container"
                        }`}
                        style={{ width: `${membership.membership === "free" ? Math.max(Math.min((displayProjectsCount / 5) * 100, 100), 4) : 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Upgrade CTA */}
                  <button 
                    onClick={() => setShowUpgradeModal(true)} 
                    className="w-full py-3.5 bg-tertiary hover:brightness-110 active:scale-[0.98] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2"
                  >
                    <span>{membership.membership === "free" ? "Upgrade Plan" : "Extend Plan"}</span>
                  </button>
                </div>

                {/* Sub-row: Customer Life Cycle Stats */}
                  {(membership.joiningDate || membership.memberSince) && (
                  <div className="mt-6 pt-4 border-t border-outline/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10 text-xs font-semibold text-secondary">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0">calendar_month</span>
                      <span>Joined: <strong className="text-on-surface">{new Date(membership.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0">verified</span>
                      <span>Plan activated: <strong className="text-on-surface">{new Date(membership.memberSince).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> ({membership.totalDays} day{membership.totalDays > 1 ? 's' : ''} active)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0">autorenew</span>
                      <span>Renewals: <strong className="text-on-surface">{membership.subscriptionCount || 0} time{membership.subscriptionCount !== 1 ? 's' : ''}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 lg:justify-end">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></span>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-green-500">Live</span>
                    </div>
                  </div>
                )}

                {(userLocation || locationLoading) && (
                  <div className="mt-6 pt-4 border-t border-outline/10 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10 text-xs font-semibold text-secondary">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0">location_on</span>
                      <span>
                        Location:{' '}
                        <strong className="text-on-surface">
                          {locationLoading ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                              Detecting…
                            </span>
                          ) : userLocation?.locationName ? (
                            userLocation.locationName
                          ) : permissionDenied ? (
                            'Permission denied'
                          ) : (
                            'Unknown'
                          )}
                        </strong>
                      </span>
                    </div>
                    {userLocation?.latitude != null && (
                      <div className="flex items-center gap-2 sm:justify-end">
                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0">pin_drop</span>
                        <span>
                          Coordinates:{' '}
                          <strong className="text-on-surface font-mono">
                            {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                {membership.membership === "free" && displayProjectsCount >= 5 && (
                  <p className="text-[10px] text-rose-500 font-bold mt-4 flex items-center gap-1.5 border-t border-outline/10 pt-3">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    Usage limit reached. Upgrade to create unlimited projects.
                  </p>
                )}
              </div>

              {/* Points Wallet & Auto-Exchange Card */}
              <div className="lg:col-span-1 glass-card rounded-[2rem] p-6 border border-outline hover:shadow-ambient-soft transition-all bg-surface-container-lowest/30 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                        <span className="material-symbols-outlined text-[22px]">monetization_on</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-secondary/70">Points Balance</span>
                        <h4 className="text-lg font-black text-on-surface leading-none mt-0.5">
                          {membership.points ?? 0} Pts
                        </h4>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full border border-green-500/20">Auto Exchange</span>
                  </div>

                  <p className="text-[11px] text-secondary font-semibold mb-4 leading-relaxed">
                    Exchanges automatically to Premium packages:
                  </p>

                  <div className="space-y-1.5 mb-5 text-[10px] font-bold text-secondary">
                    {(currencyData?.plans && currencyData.plans.length > 0
                      ? currencyData.plans
                      : [
                          { planId: "premium_1m",  pointsExchange: 250,  name: "1 Month Pro" },
                          { planId: "premium_3m",  pointsExchange: 500,  name: "3 Months Pro" },
                          { planId: "premium_6m",  pointsExchange: 1000, name: "6 Months Pro" },
                          { planId: "premium_12m", pointsExchange: 2200, name: "1 Year Pro" },
                        ]
                    ).map((plan: any, idx: number) => (
                      <div key={plan.planId || `plan-${idx}`} className="flex justify-between items-center p-1.5 rounded bg-surface/50 border border-outline/5">
                        <span>{plan.pointsExchange} Points</span>
                        <span className="text-primary">{plan.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Product Grid */}
            <section className="space-y-md">
              <h2 className="font-h3 text-h3 text-on-surface tracking-tight">Your Academic Dashboards</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {studioCategories.map((studio) => {
                  const Icon = studio.icon;
                  return (
                    <div key={studio.id} className="glass-card rounded-xl border border-outline hover:border-primary/50 hover:shadow-ambient-soft transition-all group overflow-hidden relative z-0">
                      <Link href={studio.id === 'DOC2LATEX' ? '/upload' : studio.id === 'LATEX_STUDIO' ? '/latex-studio/projects' : studio.id === 'DIAGRAM' ? '/diagrams/editor' : '#'} className="block p-md border-b border-outline bg-surface/40 relative z-10 hover:bg-surface-container-low transition-colors">
                        <div className="flex items-center mb-4">
                          <div className={`w-12 h-12 rounded-lg ${studio.bg} flex items-center justify-center mr-4 shadow-sm border border-black/5`}>
                            <Icon className={studio.color} size={32} />
                          </div>
                          <div>
                            <h3 className="font-body-lg font-bold text-on-surface leading-tight">{studio.title}</h3>
                            <p className="font-body-sm text-secondary font-medium">{studio.sub}</p>
                          </div>
                        </div>
                        <div className={`${studio.color} font-body-sm font-bold flex items-center group-hover:underline`}>
                          See Recent Activity <ChevronDown size={14} className="ml-1" />
                        </div>
                      </Link>

                      {/* Interactive Reveal Table */}
                      <div className="absolute left-0 right-0 top-full bg-surface overflow-hidden transition-all duration-300 opacity-0 group-hover:opacity-100 z-20 shadow-lg border-x border-b border-outline rounded-b-xl max-h-0 group-hover:max-h-56 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-container-low font-label-bold text-secondary border-b border-outline text-[10px]">
                              <th className="p-3 font-bold uppercase tracking-widest">Title</th>
                              <th className="p-3 font-bold uppercase tracking-widest">Stats</th>
                              <th className="p-3 font-bold uppercase tracking-widest text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="font-body-sm text-on-surface">
                            {projects.filter(p => p.type === studio.id || (studio.id === 'LATEX_STUDIO' && p.type === 'LATEX_STUDIO')).slice(0, 3).map((p, idx) => (
                              <tr key={p.id || `proj-sm-${idx}`} className="border-b border-outline/50 hover:bg-surface-bright transition-colors cursor-pointer" onClick={() => handleSelectProject(p)}>
                                <td className="p-3 truncate max-w-[130px] font-bold">{p.title}</td>
                                <td className="p-3 text-secondary font-medium">
                                  {p.stats?.words || 0}w • {p.stats?.images || 0}f
                                </td>
                                <td className="p-3 flex justify-center gap-3" onClick={(e) => e.stopPropagation()}>
                                  <button className="text-primary hover:scale-125 transition-transform"><FileDown size={14} /></button>
                                  <button className="text-secondary hover:text-on-surface hover:scale-125 transition-transform"><Archive size={14} /></button>
                                  <button onClick={() => handleDeleteProject(p.id, p.isLocal)} className="text-error hover:scale-125 transition-transform" title="Delete"><Trash2 size={14} /></button>
                                </td>
                              </tr>
                            ))}
                            {projects.filter(p => p.type === studio.id).length === 0 && (
                              <tr>
                                <td colSpan={3} className="p-8 text-center text-secondary italic font-medium">No recent activity</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* History & Info Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mt-gutter">
            {/* REFINED DYNAMIC LISTS: DOC ANALYSIS & LATEX FILES */}
            <section className="lg:col-span-2 grid grid-cols-1 gap-gutter">
              {/* Scholarly Intelligence Reports (Doc2Latex) */}
              <div className="glass-card rounded-[2rem] border border-outline p-8 flex flex-col h-full bg-surface-container-lowest/30">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-sm border border-blue-500/20">
                      <Shield size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-on-surface tracking-tight">Intelligence Reports</h2>
                        <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Live
                        </span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60">Recent Doc Analysis</p>
                    </div>
                  </div>
                  <Link href="/history?type=DOC2LATEX" className="p-2 rounded-xl hover:bg-surface-container transition-colors text-secondary">
                    <ExternalLink size={20} />
                  </Link>
                </div>

                <div className="flex-1 space-y-4">
                  {docReports.map((p, idx) => (
                    <motion.div
                      key={p.id || `doc-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group p-4 rounded-2xl bg-surface border border-outline/50 hover:border-blue-500/30 hover:shadow-joy-subtle transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4 min-w-0 w-full sm:w-auto">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-on-surface truncate pr-4 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={p.title}>{p.title}</h4>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 bg-blue-500/5 dark:bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/10">
                              <Files size={13} /> {p.stats?.words || 0} words
                            </span>
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 bg-slate-500/5 dark:bg-slate-500/10 px-2.5 py-1 rounded-md border border-slate-500/10">
                              <RefreshCw size={13} /> {new Date(p.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center ml-auto sm:ml-0 flex-shrink-0">
                        <button 
                          onClick={() => router.push(`/upload?id=${p.id}`)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-500/20 transition-all border border-slate-200 dark:border-slate-800 hover:border-blue-500/20 shadow-sm bg-white dark:bg-slate-900" 
                          title="View Report"
                        >
                          <FileText size={15} />
                        </button>
                        <button 
                          onClick={() => handleDownloadPDF(p)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-500/20 transition-all border border-slate-200 dark:border-slate-800 hover:border-blue-500/20 shadow-sm bg-white dark:bg-slate-900" 
                          title="Download Report PDF"
                        >
                          <FileDown size={15} />
                        </button>
                        <button 
                          onClick={() => window.open(`/upload?id=${p.id}&print=true`, '_blank')} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-500/20 transition-all border border-slate-200 dark:border-slate-800 hover:border-blue-500/20 shadow-sm bg-white dark:bg-slate-900" 
                          title="Print Report"
                        >
                          <Printer size={15} />
                        </button>
                        <button 
                          onClick={() => handleShare(p)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-500/20 transition-all border border-slate-200 dark:border-slate-800 hover:border-blue-500/20 shadow-sm bg-white dark:bg-slate-900" 
                          title="Share"
                        >
                          <Share2 size={15} />
                        </button>
                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1 self-center" />
                        <button 
                          onClick={() => handleDeleteProject(p.id, p.isLocal)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-500 dark:text-rose-400 dark:hover:bg-rose-500 transition-all border border-slate-200 dark:border-slate-800 hover:border-rose-500 shadow-sm bg-white dark:bg-slate-900" 
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {reportsLoading || projectsLoading ? (
                    <div className="py-12 text-center space-y-4 bg-surface-container-low/30 rounded-3xl border border-dashed border-outline">
                      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                      <p className="text-secondary font-medium italic text-xs">Syncing reports...</p>
                    </div>
                  ) : reportsError ? (
                    <div className="py-12 text-center space-y-4 bg-surface-container-low/30 rounded-3xl border border-error/30">
                      <p className="text-error font-medium italic text-xs">Failed to load reports. Retrying...</p>
                    </div>
                  ) : docReports.length === 0 ? (
                    <div className="py-20 text-center space-y-4 bg-surface-container-low/30 rounded-3xl border border-dashed border-outline">
                      <FileText size={48} className="mx-auto text-outline/40" />
                      <p className="text-secondary font-medium italic">No recent doc analysis found.</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Success LaTeX Projects (Latexify) */}
              <div className="glass-card rounded-[2rem] border border-outline p-8 flex flex-col h-full bg-surface-container-lowest/30">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
                      <Zap size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-on-surface tracking-tight">Active LaTeX Projects</h2>
                        <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Live
                        </span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60">Recent LaTeX Files</p>
                    </div>
                  </div>
                  <Link href="/history?type=LATEX_STUDIO" className="p-2 rounded-xl hover:bg-surface-container transition-colors text-secondary">
                    <ExternalLink size={20} />
                  </Link>
                </div>

                <div className="flex-1 space-y-4">
                  {latexProjects.map((p, idx) => (
                    <motion.div
                      key={p.id || `latex-${idx}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group p-4 rounded-2xl bg-surface border border-outline/50 hover:border-teal-500/30 hover:shadow-joy-subtle transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4 min-w-0 w-full sm:w-auto">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-on-surface truncate pr-4 text-sm group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" title={p.title}>{p.title}</h4>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 bg-teal-500/5 dark:bg-teal-500/10 px-2.5 py-1 rounded-md border border-teal-500/10">
                              <Files size={13} /> {p.stats?.images || 0} files
                            </span>
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 bg-slate-500/5 dark:bg-slate-500/10 px-2.5 py-1 rounded-md border border-slate-500/10">
                              <History size={13} /> {new Date(p.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center ml-auto sm:ml-0 flex-shrink-0">
                        <button 
                          onClick={() => handleDownloadPDF(p)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-teal-500 hover:bg-teal-500/10 dark:text-slate-400 dark:hover:text-teal-400 dark:hover:bg-teal-500/20 transition-all border border-slate-200 dark:border-slate-800 hover:border-teal-500/20 shadow-sm bg-white dark:bg-slate-900" 
                          title="Download PDF"
                        >
                          <FileDown size={15} />
                        </button>
                        <button 
                          onClick={() => handleDownloadZip(p)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-teal-500 hover:bg-teal-500/10 dark:text-slate-400 dark:hover:text-teal-400 dark:hover:bg-teal-500/20 transition-all border border-slate-200 dark:border-slate-800 hover:border-teal-500/20 shadow-sm bg-white dark:bg-slate-900" 
                          title="Export ZIP"
                        >
                          <FileArchive size={15} />
                        </button>
                        <button 
                          onClick={() => handleShare(p)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-teal-500 hover:bg-teal-500/10 dark:text-slate-400 dark:hover:text-teal-400 dark:hover:bg-teal-500/20 transition-all border border-slate-200 dark:border-slate-800 hover:border-teal-500/20 shadow-sm bg-white dark:bg-slate-900" 
                          title="Share"
                        >
                          <Share2 size={15} />
                        </button>
                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1 self-center" />
                        <button 
                          onClick={() => handleDeleteProject(p.id, p.isLocal)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-500 dark:text-rose-400 dark:hover:bg-rose-500 transition-all border border-slate-200 dark:border-slate-800 hover:border-rose-500 shadow-sm bg-white dark:bg-slate-900" 
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {projectsLoading ? (
                    <div className="py-12 text-center space-y-4 bg-surface-container-low/30 rounded-3xl border border-dashed border-outline">
                      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                      <p className="text-secondary font-medium italic text-xs">Syncing projects...</p>
                    </div>
                  ) : latexProjects.length === 0 ? (
                    <div className="py-20 text-center space-y-4 bg-surface-container-low/30 rounded-3xl border border-dashed border-outline">
                      <FileEdit size={48} className="mx-auto text-outline/40" />
                      <p className="text-secondary font-medium italic">No active LaTeX projects found.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

              <section className="space-y-md">
                {activeOffersList && activeOffersList.length > 0 ? (
                  <div className="rounded-xl border border-tertiary-container/20 bg-tertiary-container/5 p-md relative overflow-hidden group shadow-sm">
                    <div className="flex items-start mb-4 relative z-10">
                      <Tag className="text-tertiary mr-2" size={24} />
                      <h3 className="font-body-lg font-bold text-on-surface font-black uppercase tracking-wider text-xs">Special Offers</h3>
                    </div>
                    <div className="space-y-4 relative z-10">
                      {activeOffersList.map((offer, idx) => (
                        <div 
                          key={offer.id || `offer-${idx}`} 
                          className="bg-surface/80 rounded-2xl p-4 border border-outline hover:border-amber-500/50 transition-all duration-300 relative z-10 shadow-sm flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-body-md font-bold text-tertiary text-sm leading-snug">{offer.title}</p>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 shrink-0">
                              {offer.discountPercent ? `${offer.discountPercent}% Off` : `₹${offer.discountAmount} Off`}
                            </span>
                          </div>
                          <p className="text-[11px] text-secondary/90 font-medium mb-3 leading-relaxed">{offer.description || "Special promo discount."}</p>
                          
                          <div className="flex items-center justify-between border-t border-outline/10 pt-3 mt-1">
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-outline/30">
                              <span className="font-mono text-xs font-black text-primary tracking-wider">{offer.code}</span>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(offer.code);
                                  alert(`Promo code "${offer.code}" copied to clipboard!`);
                                }}
                                className="p-1 hover:text-primary text-secondary transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                                title="Copy Promo Code"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                            
                            <button 
                              onClick={() => {
                                setShowUpgradeModal(true);
                                handleApplyPromoCode(offer.code);
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-white bg-tertiary px-4 py-2 rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
                            >
                              Claim Offer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-outline bg-surface-container-low/20 p-md relative overflow-hidden group shadow-sm">
                    <div className="flex items-start mb-2 relative z-10">
                      <Tag className="text-secondary mr-2" size={24} />
                      <h3 className="font-body-lg font-bold text-secondary font-black uppercase tracking-wider text-xs">Special Offers</h3>
                    </div>
                    <div className="bg-surface/80 rounded-lg p-4 border border-outline relative z-10 shadow-sm">
                      <p className="text-xs text-secondary font-medium italic text-center">No active special offers currently available.</p>
                    </div>
                  </div>
                )}

                <div className="glass-card rounded-xl border border-outline p-md shadow-sm">
                  <div className="flex items-center mb-6">
                    <Megaphone className="text-amber-500 mr-2" size={24} />
                    <h3 className="font-body-lg font-bold text-on-surface">Notice Board</h3>
                  </div>
                  {loadingAnnouncements && announcements.length === 0 ? (
                    <p className="text-xs text-secondary font-medium italic text-center">Loading notices...</p>
                  ) : announcements.length > 0 ? (
                    <ul className="space-y-4 font-body-sm">
                      {announcements.map((ann, idx) => (
                        <li key={ann.id || `ann-${idx}`} className="flex items-start">
                          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 mr-3 flex-shrink-0 ${
                            ann.priority === 'critical' ? 'bg-red-500' :
                            ann.priority === 'warning' ? 'bg-amber-500' : 'bg-primary'
                          }`} />
                          <span className="text-secondary leading-tight font-medium">{ann.content}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-secondary font-medium italic text-center">No active announcements.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Slide-over Modal */}
      <AnimatePresence>
        {selectedProject && (
          <>
            {/* Backdrop Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProject(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed left-1/2 top-1/2 w-full max-w-[600px] bg-surface z-[100] shadow-ambient-deep border border-outline flex flex-col rounded-[2rem] overflow-hidden"
              style={{ height: '60%' }}
            >
              <div className="p-6 border-b border-outline flex items-center justify-between bg-surface-container-low relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-md">
                    <FileText size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-on-surface tracking-tight">Project Details</h2>
                </div>
                <button onClick={() => setSelectedProject(null)} className="text-secondary hover:text-on-surface transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scroll space-y-12 flex flex-col justify-between">
              {detailsLoading || !selectedProjectDetails ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] space-y-4">
                  <RefreshCw className="animate-spin text-primary" size={40} />
                  <p className="text-secondary font-medium animate-pulse text-sm">Analyzing Manuscript Assets...</p>
                </div>
              ) : (
                <>
                  <ProjectStats 
                    stats={{
                      wordCount: selectedProjectDetails.stats?.words || selectedProjectDetails.wordCount || 0,
                      charCount: selectedProjectDetails.stats?.characters || selectedProjectDetails.charCount || 0,
                      imageCount: selectedProjectDetails.stats?.images || selectedProjectDetails.imageCount || 0,
                      chartCount: selectedProjectDetails.stats?.charts || selectedProjectDetails.chartCount || 0,
                      tableCount: selectedProjectDetails.stats?.tables || selectedProjectDetails.tableCount || 0,
                      equationCount: selectedProjectDetails.stats?.equations || selectedProjectDetails.equationCount || 0,
                      citationCount: selectedProjectDetails.stats?.citations || selectedProjectDetails.citationCount || 0,
                      referenceCount: selectedProjectDetails.stats?.references || selectedProjectDetails.referenceCount || 0,
                      pseudocodeCount: selectedProjectDetails.stats?.pseudocode || selectedProjectDetails.pseudocodeCount || 0
                    }}
                    metadata={{
                       title: selectedProjectDetails.title,
                       authors: safeParse(selectedProjectDetails.structuredContent).authors || [],
                       abstract: safeParse(selectedProjectDetails.structuredContent).abstract || "",
                       contribution: safeParse(selectedProjectDetails.structuredContent).contribution || "",
                       structuredContent: selectedProjectDetails.structuredContent
                     }}
                  />

                  <div className="pt-8 border-t border-outline flex gap-4">
                    <Link 
                      href={selectedProject.isLocal ? `/latex-studio/${selectedProject.id}` : `/editor/${selectedProject.id}`}
                      className="flex-1 h-14 bg-primary text-white rounded-lg font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:brightness-110 transition-all"
                    >
                      <ExternalLink size={20} />
                      Open Editorial IDE
                    </Link>
                    <button 
                      onClick={() => handleDeleteProject(selectedProject.id, selectedProject.isLocal)}
                      className="h-14 px-6 bg-red-500/10 text-error hover:bg-red-500/20 rounded-lg font-bold flex items-center justify-center transition-all border border-error/20"
                      title="Delete Project"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white p-8 rounded-[2.5rem] max-w-2xl w-full shadow-2xl border border-slate-100 relative flex flex-col items-center text-center backdrop-blur-xl max-h-[90vh] overflow-y-auto custom-scroll"
            >
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors border-none cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="relative group mb-6">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl border-4 border-slate-200 overflow-hidden relative">
                  {profileImage ? (
                    <Image fill src={profileImage} alt="Avatar" className="object-cover" sizes="96px" />
                  ) : (
                    <span>{profileName?.[0]?.toUpperCase() || session.user?.name?.[0]?.toUpperCase()}</span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-primary/90 transition-colors border border-white">
                  <Camera size={14} />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          setProfileImage(base64String);
                          localStorage.setItem('user_profile_image', base64String);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              <h3 className="font-display text-2xl font-bold text-slate-900 mb-1">Profile Settings</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-6">Custom Workspace Profile</p>

              <div className="w-full flex flex-col gap-4">
                <div className="flex flex-col items-start">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 px-1">Full Name</label>
                  <input 
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                  />
                </div>

                <div className="flex flex-col items-start">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 px-1">Change Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                  />
                </div>

                <div className="flex flex-col items-start">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 px-1">Workplace Email</label>
                  <input 
                    type="email"
                    disabled
                    value={session.user?.email || ""}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 text-slate-400 focus:outline-none font-semibold cursor-not-allowed"
                  />
                </div>
              </div>

              <button 
                onClick={async () => {
                  const payload: any = {};
                  if (profileName.trim()) payload.name = profileName.trim();
                  if (profilePassword.trim()) payload.password = profilePassword.trim();
                  
                  if (Object.keys(payload).length > 0) {
                    try {
                      const res = await fetch("/api/auth/profile", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                      });
                      if (res.ok) {
                        alert("Profile settings updated successfully!");
                        setProfilePassword("");
                        if (payload.name) {
                          await update({ name: payload.name });
                        }
                      } else {
                        const data = await res.json();
                        alert(data.error || "Failed to update profile settings.");
                      }
                    } catch (err: any) {
                      alert("Error: " + err.message);
                    }
                }
                setIsProfileOpen(false);
              }}
              className="w-full mt-8 py-3 bg-primary text-white font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle size={18} />
              Save Profile Settings
            </button>
            <a
              href="/dashboard/change-password"
              className="w-full mt-3 py-2.5 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <KeyRound size={16} />
              Change Password
            </a>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upgrade Plan Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md px-4 py-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] max-w-3xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 relative flex flex-col items-center my-auto max-h-[90vh] overflow-y-auto custom-scroll"
            >
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors border-none cursor-pointer z-10"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">Upgrade to Latexify Premium</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 text-center">
                Get unlimited projects, premium LaTeX compilation nodes, full AI Peer Reviewer evaluations, and advanced document extraction.
              </p>

              {appliedOffer && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-4 rounded-xl text-xs font-semibold w-full mb-6 text-center animate-pulse-slow">
                  🎉 You have selected the &quot;{appliedOffer.title}&quot; offer! A discount of {appliedOffer.discountPercent ? `${appliedOffer.discountPercent}%` : `₹${appliedOffer.discountAmount}`} has been applied to the selected plan.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-6">
                {currencyData?.plans && currencyData.plans.length > 0 ? (
                  currencyData.plans.map((p: any, idx: number) => {
                    const isRecommended = p.planId === "premium_3m";
                    const isSelected = selectedPlanId === p.planId;
                    const durationText =
                      p.durationMonths === 1 ? "month" :
                      p.durationMonths === 3 ? "quarter" :
                      p.durationMonths === 12 ? "year" :
                      p.durationMonths % 12 === 0 ? `${p.durationMonths / 12} years` :
                      `${p.durationMonths} months`;
                    return (
                      <div 
                        key={p.planId || `plan-${idx}`} 
                        className={`p-5 border rounded-2xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                          isSelected 
                            ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md scale-[1.01]" 
                            : isRecommended 
                              ? "border-amber-500/40 bg-amber-50/10 dark:bg-amber-950/10" 
                              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                        }`}
                      >
                        {isRecommended && (
                          <div className="absolute top-0 right-0 bg-amber-500 text-white font-mono text-[9px] font-bold px-3 py-1 rounded-bl-xl">
                            RECOMMENDED
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">{p.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
                        </div>
                        <div className="mt-4">
                          {appliedOffer && isSelected ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-400 line-through">
                                {currencyData.symbol}{p.convertedPrice}
                              </span>
                              <span className="text-2xl font-bold text-primary animate-pulse-slow">
                                {currencyData.symbol}{getDiscountedPrice(p.planId)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-2xl font-bold text-primary">
                              {currencyData.symbol}{p.convertedPrice}
                            </span>
                          )}
                          <span className="text-sm text-slate-400"> / {durationText}</span>
                        </div>
                        <button 
                          onClick={() => {
                            if (isSelected) {
                              initiatePayment(p.planId);
                            } else {
                              setSelectedPlanId(p.planId);
                            }
                          }}
                          disabled={paymentLoading}
                          className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer border-none ${
                            isSelected
                              ? "bg-amber-500 text-white shadow-md"
                              : "bg-primary text-white"
                          }`}
                        >
                          {isSelected ? "Proceed to Pay" : "Select Plan"}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <>
                    <div className={`p-5 border rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                      selectedPlanId === 'premium_1m'
                        ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md scale-[1.01]" 
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                    }`}>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">1 Month Plan</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Basic monthly upgrade</p>
                      </div>
                      <div className="mt-4">
                        {appliedOffer && selectedPlanId === 'premium_1m' ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 line-through">₹250</span>
                            <span className="text-2xl font-bold text-primary animate-pulse-slow">₹{getDiscountedPrice('premium_1m')}</span>
                          </div>
                        ) : (
                          <span className="text-2xl font-bold text-primary">₹250</span>
                        )}
                        <span className="text-sm text-slate-400"> / month</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (selectedPlanId === 'premium_1m') {
                            initiatePayment('premium_1m');
                          } else {
                            setSelectedPlanId('premium_1m');
                          }
                        }}
                        disabled={paymentLoading}
                        className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer border-none ${
                          selectedPlanId === 'premium_1m'
                            ? "bg-amber-500 text-white shadow-md"
                            : "bg-primary text-white"
                        }`}
                      >
                        {selectedPlanId === 'premium_1m' ? "Proceed to Pay" : "Select Plan"}
                      </button>
                    </div>

                    <div className={`p-5 border rounded-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                      selectedPlanId === 'premium_3m'
                        ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md scale-[1.01]" 
                        : "border-amber-500/40 bg-amber-50/10 dark:bg-amber-950/10"
                    }`}>
                      <div className="absolute top-0 right-0 bg-amber-500 text-white font-mono text-[9px] font-bold px-3 py-1 rounded-bl-xl">RECOMMENDED</div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">3 Months Plan</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Quarterly billing cycle</p>
                      </div>
                      <div className="mt-4">
                        {appliedOffer && selectedPlanId === 'premium_3m' ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 line-through">₹600</span>
                            <span className="text-2xl font-bold text-primary animate-pulse-slow">₹{getDiscountedPrice('premium_3m')}</span>
                          </div>
                        ) : (
                          <span className="text-2xl font-bold text-primary">₹600</span>
                        )}
                        <span className="text-sm text-slate-400"> / quarter</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (selectedPlanId === 'premium_3m') {
                            initiatePayment('premium_3m');
                          } else {
                            setSelectedPlanId('premium_3m');
                          }
                        }}
                        disabled={paymentLoading}
                        className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer border-none ${
                          selectedPlanId === 'premium_3m'
                            ? "bg-amber-500 text-white shadow-md"
                            : "bg-primary text-white"
                        }`}
                      >
                        {selectedPlanId === 'premium_3m' ? "Proceed to Pay" : "Select Plan"}
                      </button>
                    </div>

                    <div className={`p-5 border rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                      selectedPlanId === 'premium_6m'
                        ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md scale-[1.01]" 
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                    }`}>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">6 Months Plan</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Semi-annual savings</p>
                      </div>
                      <div className="mt-4">
                        {appliedOffer && selectedPlanId === 'premium_6m' ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 line-through">₹1100</span>
                            <span className="text-2xl font-bold text-primary animate-pulse-slow">₹{getDiscountedPrice('premium_6m')}</span>
                          </div>
                        ) : (
                          <span className="text-2xl font-bold text-primary">₹1100</span>
                        )}
                        <span className="text-sm text-slate-400"> / 6 months</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (selectedPlanId === 'premium_6m') {
                            initiatePayment('premium_6m');
                          } else {
                            setSelectedPlanId('premium_6m');
                          }
                        }}
                        disabled={paymentLoading}
                        className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer border-none ${
                          selectedPlanId === 'premium_6m'
                            ? "bg-amber-500 text-white shadow-md"
                            : "bg-primary text-white"
                        }`}
                      >
                        {selectedPlanId === 'premium_6m' ? "Proceed to Pay" : "Select Plan"}
                      </button>
                    </div>

                    <div className={`p-5 border rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                      selectedPlanId === 'premium_12m'
                        ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md scale-[1.01]" 
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                    }`}>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">12 Months Plan</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Best annual value</p>
                      </div>
                      <div className="mt-4">
                        {appliedOffer && selectedPlanId === 'premium_12m' ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 line-through">₹2100</span>
                            <span className="text-2xl font-bold text-primary animate-pulse-slow">₹{getDiscountedPrice('premium_12m')}</span>
                          </div>
                        ) : (
                          <span className="text-2xl font-bold text-primary">₹2100</span>
                        )}
                        <span className="text-sm text-slate-400"> / year</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (selectedPlanId === 'premium_12m') {
                            initiatePayment('premium_12m');
                          } else {
                            setSelectedPlanId('premium_12m');
                          }
                        }}
                        disabled={paymentLoading}
                        className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer border-none ${
                          selectedPlanId === 'premium_12m'
                            ? "bg-amber-500 text-white shadow-md"
                            : "bg-primary text-white"
                        }`}
                      >
                        {selectedPlanId === 'premium_12m' ? "Proceed to Pay" : "Select Plan"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Promo Code Section */}
              <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-6 mb-6">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-1.5">
                  <Tag size={16} className="text-primary" /> Apply Promo Code
                </h4>
                
                {/* Auto-populated selectable active offers */}
                {activeOffersList && activeOffersList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {activeOffersList.map((offer, idx) => {
                      const isSelected = appliedOffer?.code === offer.code;
                      return (
                        <button
                          key={offer.id || `offer2-${idx}`}
                          onClick={() => {
                            if (isSelected) {
                              handleRemovePromoCode();
                            } else {
                              handleApplyPromoCode(offer.code);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer border-solid ${
                            isSelected
                              ? "bg-primary border-primary text-white shadow-xs"
                              : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          <Tag size={12} />
                          {offer.code} ({offer.discountPercent ? `${offer.discountPercent}%` : `₹${offer.discountAmount}`})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Manual text input */}
                <div className="flex gap-2 max-w-md w-full">
                  <input 
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder="Enter Coupon Code"
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  />
                  <button
                    onClick={() => handleApplyPromoCode()}
                    className="px-4 py-2.5 bg-slate-900 dark:bg-slate-100 hover:opacity-90 text-white dark:text-slate-900 rounded-xl font-bold text-sm transition-all cursor-pointer border-none"
                  >
                    Apply
                  </button>
                </div>

                {/* Success/Error displays */}
                {promoError && (
                  <p className="text-rose-500 text-xs mt-2 font-semibold flex items-center gap-1">
                    ⚠️ {promoError}
                  </p>
                )}
                {promoSuccessMessage && (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-between">
                    <span>🎉 {promoSuccessMessage}</span>
                    <button 
                      onClick={handleRemovePromoCode}
                      className="text-emerald-700 dark:text-emerald-300 underline font-bold bg-transparent border-none cursor-pointer hover:opacity-85"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                <Check className="text-emerald-500" size={14} /> Secure payments powered by Cashfree (UPI &amp; QR enabled)
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Membership Expiry Reminder Modal */}
      <AnimatePresence>
        {reminderInfo && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 relative flex flex-col items-center text-center max-h-[90vh] overflow-y-auto custom-scroll"
            >
              <button 
                onClick={() => setReminderInfo(null)}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors border-none cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shrink-0">
                <Bell size={24} className="animate-bounce" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Membership Expiring Soon!</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                Your Premium Membership is expiring in <strong className="text-amber-500">{reminderInfo.daysLeft} days</strong> (on {reminderInfo.expiryDate}). Renew now to maintain unlimited projects and premium features.
              </p>

              <div className="flex gap-4 w-full">
                <button
                  onClick={() => {
                    setReminderInfo(null);
                    setShowUpgradeModal(true);
                  }}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-95 transition-all cursor-pointer border-none"
                >
                  Renew Now
                </button>
                <button
                  onClick={() => setReminderInfo(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border-none"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ChatWidget />
    </div>
  );
}

