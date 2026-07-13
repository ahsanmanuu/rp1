import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFromRequest } from '@/lib/adminAuth';
import { getLogoBase64 } from '@/lib/logo';

export const dynamic = 'force-dynamic';

const formatMembership = (m: string) => {
  const map: Record<string, string> = {
    free:        'Free Plan',
    premium_1m:  'Pro (1M)',
    premium_3m:  'Pro (3M)',
    premium_6m:  'Pro (6M)',
    premium_12m: 'Pro (12M)',
  };
  return map[m] || m;
};

// ── PDF header ────────────────────────────────────────────────────────────────
function drawPdfHeader(
  doc: any,
  title: string,
  primary: [number, number, number],
  logoBase64: string
) {
  const pw = doc.internal.pageSize.width;

  // Accent bar
  doc.setFillColor(...primary);
  doc.rect(0, 0, pw, 5, 'F');

  // Logo
  let textX = 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 48, 12);
      textX = 66;
    } catch (e: any) {
      console.error("jsPDF addImage failed:", e.message);
    }
  } else {
    console.warn("drawPdfHeader: logoBase64 string is empty");
  }

  // Company name
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Latexify', textX, 16);

  // Tagline
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Professional LaTeX Editorial for Researchers', textX, 22);

  // Contact (right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('www.latexify.io',     pw - 14, 13, { align: 'right' });
  doc.text('contact@latexify.io', pw - 14, 18, { align: 'right' });
  doc.text('Bangalore, India',    pw - 14, 23, { align: 'right' });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 27, pw - 14, 27);

  // Title
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, 14, 34);

  // Date
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Exported: ${new Date().toLocaleString('en-IN')}`, pw - 14, 34, { align: 'right' });
}

// ── PDF footer (3 rows, no overlap) ─────────────────────────────────────────
function drawPdfFooter(doc: any, primary: [number, number, number]) {
  const pageCount = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Divider line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(14, ph - 22, pw - 14, ph - 22);

    // Row 1 — left: source | right: page
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Latexify Super Admin Console', 14, ph - 16);
    doc.text(`Page ${i} / ${pageCount}`, pw - 14, ph - 16, { align: 'right' });

    // Row 2 — center: confidential
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(220, 38, 38);
    doc.text('CONFIDENTIAL — INTERNAL USE ONLY', pw / 2, ph - 10, { align: 'center' });

    // Row 3 — copyright
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('© 2026 Latexify. All rights reserved.', pw / 2, ph - 5, { align: 'center' });
  }
}

async function fetchUsersData() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      projects: { select: { id: true } },
      blacklistRecords: { orderBy: { createdAt: 'desc' }, take: 1, select: { reason: true } },
      sessionActivities: { orderBy: { createdAt: 'desc' }, take: 1, select: { ipAddress: true, location: true } },
    },
  });

  const logs = await prisma.aiUsageLog.groupBy({
    by: ['userId'],
    _sum: { totalTokens: true },
  });
  const tokenMap: Record<string, number> = {};
  logs.forEach((l: any) => { if (l.userId) tokenMap[l.userId] = l._sum.totalTokens || 0; });

  return users.map((u: any) => ({
    id: u.id,
    name: u.name || 'Unnamed Scholar',
    email: u.email,
    role: u.role || 'user',
    status: u.status || 'active',
    membership: formatMembership(u.membership || 'free'),
    membershipRaw: u.membership || 'free',
    membershipExpiresAt: u.membershipExpiresAt || null,
    points: u.points || 0,
    aiTokensUsed: tokenMap[u.id] || 0,
    projectCount: u.projects?.length || 0,
    lastIp: u.sessionActivities?.[0]?.ipAddress || 'N/A',
    lastLocation: u.sessionActivities?.[0]?.location || 'N/A',
    blacklistReason: u.blacklistRecords?.[0]?.reason || 'None',
    blockedUntil: u.blockedUntil || null,
    createdAt: u.createdAt,
  }));
}

// GET /api/admin/export/users?format=excel|pdf&theme=indigo
export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'excel';
  const theme  = (searchParams.get('theme') ?? 'indigo') as 'indigo' | 'emerald' | 'rose';

  const users = await fetchUsersData();

  const totalCount      = users.length;
  const activeCount     = users.filter((u: any) => u.status !== 'blacklisted').length;
  const abnormalCount   = users.filter((u: any) => u.status === 'abnormal').length;
  const overAccessCount = users.filter((u: any) => u.aiTokensUsed > 50000).length;
  const tempLockedCount = users.filter((u: any) =>
    u.status !== 'blacklisted' && !!(u.blockedUntil && new Date(u.blockedUntil) > new Date())
  ).length;
  const bannedCount = users.filter((u: any) => u.status === 'blacklisted').length;

  // ── EXCEL ───────────────────────────────────────────────────────────────────
  if (format === 'excel') {
    const XLSX = await import('xlsx');

    const summaryRows = [
      ['Segment', 'Count', 'Description'],
      ['★ Latexify', 'User Audit Log', 'Branded Security Directory'],
      ['Report Type', 'User Directory & Security Audit', `Export Date: ${new Date().toLocaleString('en-IN')}`],
      ['---', '---', '---'],
      ['Total Registered Users',           totalCount,      'All platform accounts'],
      ['Active Accounts',                  activeCount,     'Not blacklisted'],
      ['Abnormal Behavior Flagged',        abnormalCount,   'Suspicious activity detected'],
      ['AI Over-Access (>50k tokens)',     overAccessCount, 'Heavy AI usage accounts'],
      ['Temporarily Locked',               tempLockedCount, 'Login / rate lockouts'],
      ['Permanently Banned / Blacklisted', bannedCount,     'Access revoked'],
    ];

    const userHeaders = [
      'User ID', 'Full Name', 'Email', 'Role', 'Status',
      'Membership Tier', 'Membership Expiry', 'Points',
      'AI Tokens Used', 'Projects', 'Last IP', 'Last Location',
      'Blacklist Reason', 'Blocked Until', 'Date Registered',
    ];
    const userRows = users.map((u: any) => [
      u.id, u.name, u.email, u.role, u.status,
      u.membership,
      u.membershipExpiresAt
        ? new Date(u.membershipExpiresAt).toLocaleString('en-IN')
        : 'Never / Free Plan',
      u.points, u.aiTokensUsed, u.projectCount,
      u.lastIp, u.lastLocation, u.blacklistReason,
      u.blockedUntil ? new Date(u.blockedUntil).toLocaleString('en-IN') : 'N/A',
      new Date(u.createdAt).toLocaleString('en-IN'),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'User Metrics Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([userHeaders, ...userRows]), 'User Directory');

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Doc2LateX_Users_${Date.now()}.xlsx"`,
      },
    });
  }

  // ── PDF ─────────────────────────────────────────────────────────────────────
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const { autoTable, applyPlugin } = await import('jspdf-autotable');
    applyPlugin(jsPDF);

    const themeColors: Record<string, [number, number, number]> = {
      indigo:  [79, 70, 229],
      emerald: [5, 150, 105],
      rose:    [225, 29, 72],
    };
    const primary = themeColors[theme] ?? themeColors.indigo;
    const logoBase64 = await getLogoBase64();

    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.width;

    // Header
    drawPdfHeader(doc, 'PLATFORM USER DIRECTORY & SECURITY AUDIT REPORT', primary, logoBase64);

    // Summary table
    autoTable(doc, {
      head: [['User Segment', 'Count', 'Description']],
      body: [
        ['Total Registered Users',          `${totalCount}`,      'All platform accounts'],
        ['Active & Sound Accounts',         `${activeCount}`,     'Not blacklisted'],
        ['Abnormal Activity Flagged',       `${abnormalCount}`,   'Rate-limiting or script access detected'],
        ['AI High Token Access',            `${overAccessCount}`, 'Token usage exceeding 50,000'],
        ['Temporarily Security Locked',     `${tempLockedCount}`, 'Login rate-block lockouts'],
        ['Permanently Banned / Suspended',  `${bannedCount}`,     'Access permanently revoked'],
      ],
      startY: 40,
      theme: 'striped',
      tableWidth: pw - 28,
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 65 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    });

    // User directory title
    const y1 = ((doc as any).lastAutoTable?.finalY ?? 100) + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('PLATFORM USER DIRECTORY', 14, y1);

    // Users table — separate columns, no \n, fixed widths
    const getStatusLabel = (u: any) => {
      if (u.status === 'blacklisted') return 'Banned';
      if (u.blockedUntil && new Date(u.blockedUntil) > new Date()) return 'Locked';
      return u.status || 'active';
    };

    autoTable(doc, {
      head: [['Name', 'Email', 'Tier', 'Points', 'AI Tokens', 'Proj', 'Status', 'Location', 'IP', 'Joined']],
      body: users.map((u: any) => [
        (u.name || 'Unknown').slice(0, 22),
        (u.email || 'N/A').slice(0, 28),
        u.membership,
        `${u.points}`,
        u.aiTokensUsed > 999 ? `${(u.aiTokensUsed / 1000).toFixed(1)}k` : `${u.aiTokensUsed}`,
        `${u.projectCount}`,
        getStatusLabel(u),
        (u.lastLocation || 'Unknown').slice(0, 14),
        (u.lastIp || 'N/A').slice(0, 15),
        new Date(u.createdAt).toLocaleDateString('en-IN'),
      ]),
      startY: y1 + 4,
      theme: 'grid',
      tableWidth: pw - 28,
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6.5,
        textColor: [71, 85, 105],
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        overflow: 'ellipsize',
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 48 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' },
        7: { cellWidth: 28 },
        8: { cellWidth: 26 },
        9: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: 14, right: 14, bottom: 28 },
    });

    // Footer
    drawPdfFooter(doc, primary);

    const pdfBuf = new Uint8Array(doc.output('arraybuffer'));
    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Doc2LateX_Users_${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
}
