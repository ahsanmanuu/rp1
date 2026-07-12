import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFromRequest } from '@/lib/adminAuth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// ── Currency table (base = INR) ───────────────────────────────────────────────
const CURRENCIES: Record<string, { symbol: string; rate: number }> = {
  INR: { symbol: '₹',   rate: 1       },
  USD: { symbol: '$',   rate: 0.012   },
  EUR: { symbol: '€',   rate: 0.011   },
  GBP: { symbol: '£',   rate: 0.0094  },
  AED: { symbol: 'AED', rate: 0.044   },
  SAR: { symbol: 'SAR', rate: 0.045   },
  SGD: { symbol: 'S$',  rate: 0.016   },
  AUD: { symbol: 'A$',  rate: 0.018   },
  CAD: { symbol: 'C$',  rate: 0.016   },
  JPY: { symbol: '¥',   rate: 1.93    },
};

const fmt = (inr: number, code: string) => {
  const cur = CURRENCIES[code] ?? CURRENCIES.INR;
  const val = inr * cur.rate;
  const dec = ['JPY', 'INR'].includes(code) ? 0 : 2;
  return `${cur.symbol}${val.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
};

const getPointsINR = (amount: number): number => {
  if (amount === 50)   return 415;
  if (amount === 200)  return 1245;
  if (amount === 1000) return 4150;
  return Math.round(amount * 8.3);
};

// ── Logo loader (server-side filesystem read with diagnostics) ───────────────
function getLogoBase64(): string {
  const candidates = [
    path.join(process.cwd(), 'public', 'logo.png'),
    path.resolve('./public/logo.png'),
    path.join(process.cwd(), '..', 'public', 'logo.png'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'logo.png')
  ];

  for (const logoPath of candidates) {
    try {
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch (e: any) {
      console.error(`Error reading logo from path ${logoPath}:`, e.message);
    }
  }

  console.error(" getLogoBase64 failed: public/logo.png not found in candidates:", candidates);
  return '';
}

// ── PDF header drawer ─────────────────────────────────────────────────────────
function drawPdfHeader(
  doc: any,
  title: string,
  primary: [number, number, number],
  logoBase64: string
) {
  const pw = doc.internal.pageSize.width;

  // Top accent bar
  doc.setFillColor(...primary);
  doc.rect(0, 0, pw, 5, 'F');

  // Logo (if available)
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

  // Contact block (right side)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('www.latexify.io',        pw - 14, 13, { align: 'right' });
  doc.text('contact@latexify.io',    pw - 14, 18, { align: 'right' });
  doc.text('Bangalore, India',       pw - 14, 23, { align: 'right' });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 27, pw - 14, 27);

  // Report title (colored)
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, 14, 34);

  // Export date (right)
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Exported: ${new Date().toLocaleString('en-IN')}`, pw - 14, 34, { align: 'right' });
}

// ── PDF footer drawer ─────────────────────────────────────────────────────────
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

    // Row 1 — left: source label | right: page number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Latexify Super Admin Console', 14, ph - 16);
    doc.text(`Page ${i} / ${pageCount}`, pw - 14, ph - 16, { align: 'right' });

    // Row 2 — center: confidential warning (red, bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(220, 38, 38);
    doc.text('CONFIDENTIAL — INTERNAL USE ONLY', pw / 2, ph - 10, { align: 'center' });

    // Row 3 — center: copyright
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('© 2026 Latexify. All rights reserved.', pw / 2, ph - 5, { align: 'center' });
  }
}

async function fetchBillingsData() {
  const pointTxs = await prisma.pointTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } }
  });
  const membershipTxs = await prisma.membershipTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } }
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let monthlyRevenue = 0, totalRefunds = 0, pendingRefunds = 0;
  let failedPaymentsCount = 0, failedPaymentsAmount = 0;
  let totalPointsCredited = 0, successfulCheckoutsCount = 0;

  pointTxs.forEach((tx: any) => {
    const v = getPointsINR(tx.amount);
    if (tx.type === 'recharge') {
      if (tx.amount > 0) totalPointsCredited += tx.amount;
      if (new Date(tx.createdAt) >= monthStart) monthlyRevenue += v;
      successfulCheckoutsCount++;
    } else if (tx.type === 'refund') {
      totalRefunds += Math.abs(v);
    } else if (tx.type === 'refund_pending') {
      pendingRefunds += Math.abs(v);
    } else if (tx.type === 'failed') {
      failedPaymentsCount++; failedPaymentsAmount += v;
    }
  });

  membershipTxs.forEach((tx: any) => {
    const v = tx.amount;
    if (tx.paymentStatus === 'paid') {
      if (new Date(tx.createdAt) >= monthStart) monthlyRevenue += v;
      successfulCheckoutsCount++;
    } else if (tx.paymentStatus === 'refunded') {
      totalRefunds += v;
    } else if (['refund_pending', 'refunded_pending'].includes(tx.paymentStatus)) {
      pendingRefunds += v;
    } else if (tx.paymentStatus === 'failed') {
      failedPaymentsCount++; failedPaymentsAmount += v;
    }
  });

  const averageOrderValue = successfulCheckoutsCount > 0
    ? monthlyRevenue / successfulCheckoutsCount : 0;

  const transactions = [
    ...pointTxs.map((tx: any) => ({
      id: tx.id,
      userEmail: tx.user?.email || 'unknown',
      userName: tx.user?.name || 'Unknown',
      amountCredits: tx.amount,
      amount: getPointsINR(tx.amount),
      description: tx.description || 'Credit adjustment',
      status: tx.type === 'recharge' ? 'Completed'
        : tx.type === 'refund' ? 'Refunded' : 'Pending',
      createdAt: tx.createdAt,
    })),
    ...membershipTxs.map((tx: any) => ({
      id: tx.id,
      userEmail: tx.user?.email || 'unknown',
      userName: tx.user?.name || 'Unknown',
      amountCredits: 0,
      amount: tx.amount,
      description: `Plan: ${tx.planType || 'N/A'}`,
      orderId: tx.orderId,
      status: tx.paymentStatus === 'paid' ? 'Completed'
        : tx.paymentStatus === 'pending' ? 'Pending' : 'Failed',
      createdAt: tx.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const userTxCounts = await prisma.membershipTransaction.groupBy({
    by: ['userId'],
    where: { paymentStatus: 'paid' },
    _count: { id: true },
  });
  const transactingUserIds = userTxCounts.map((u: any) => u.userId);
  const renewedCount = userTxCounts.filter((u: any) => u._count.id >= 2).length;
  const churnedCount = await prisma.user.count({
    where: { id: { in: transactingUserIds }, membership: 'free' },
  });

  return {
    metrics: {
      monthlyRevenue:        Math.round(monthlyRevenue),
      totalRefunds:          Math.round(totalRefunds),
      pendingRefunds:        Math.round(pendingRefunds),
      failedPaymentsCount,
      failedPaymentsAmount:  Math.round(failedPaymentsAmount),
      totalPointsCredited,
      successfulCheckoutsCount,
      averageOrderValue:     Math.round(averageOrderValue),
      renewedCount,
      churnedCount,
    },
    transactions,
  };
}

// GET /api/admin/export/billings?format=excel|pdf&currency=INR&theme=indigo
export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format   = searchParams.get('format') ?? 'excel';
  const currency = (searchParams.get('currency') ?? 'INR').toUpperCase();
  const theme    = (searchParams.get('theme') ?? 'indigo') as 'indigo' | 'emerald' | 'rose';

  // Dynamically fetch live exchange rates relative to INR from public market API
  const ratesController = new AbortController();
  const ratesTimeoutId = setTimeout(() => ratesController.abort(), 4000);
  try {
    const ratesRes = await fetch("https://open.er-api.com/v6/latest/INR", {
      signal: ratesController.signal
    });
    if (ratesRes.ok) {
      const ratesData = await ratesRes.json();
      if (ratesData && ratesData.rates) {
        Object.keys(CURRENCIES).forEach(code => {
          if (ratesData.rates[code]) {
            CURRENCIES[code].rate = ratesData.rates[code];
          }
        });
      }
    }
  } catch (err) {
    console.error("[EXPORT_BILLINGS] Failed to fetch live exchange rates:", err);
  } finally {
    clearTimeout(ratesTimeoutId);
  }

  const { metrics, transactions } = await fetchBillingsData();
  const sym = CURRENCIES[currency]?.symbol ?? '₹';

  // ── EXCEL ──────────────────────────────────────────────────────────────────
  if (format === 'excel') {
    const XLSX = await import('xlsx');

    const summaryRows = [
      ['Metric', 'Value', 'Description'],
      ['★ Latexify', 'Platform Report', 'Branded Financial Audit Log'],
      ['Report Type', `Billings & Payments (${currency})`, `Export Date: ${new Date().toLocaleString('en-IN')}`],
      ['---', '---', '---'],
      ['Monthly Revenue',         fmt(metrics.monthlyRevenue, currency),                        `Revenue in ${currency}`],
      ['Successful Checkouts',    `${metrics.successfulCheckoutsCount} Txns`,                  `Avg: ${fmt(metrics.averageOrderValue, currency)}`],
      ['Total Points Credited',   `${metrics.totalPointsCredited.toLocaleString()} Pts`,       'Recharge & admin credits'],
      ['Refunded to User',        fmt(metrics.totalRefunds, currency),                         'Fully processed refunds'],
      ['Refund Pending',          fmt(metrics.pendingRefunds, currency),                       'Awaiting pipeline'],
      ['Failed Transactions',     `${metrics.failedPaymentsCount} Txns`,                       `Volume: ${fmt(metrics.failedPaymentsAmount, currency)}`],
      ['Renewed Customers',       `${metrics.renewedCount} Accounts`,                          'Multi-time subscribers'],
      ['Churned Customers',       `${metrics.churnedCount} Accounts`,                          'Expired or inactive'],
    ];

    const txHeaders = [
      'Transaction ID', 'Order ID / Ref', 'Customer Name', 'Customer Email',
      'Description', `Amount (${sym})`, 'Credits (Pts)', 'Status', 'Date & Time',
    ];
    const txRows = transactions.map((t: any) => [
      t.id,
      t.orderId ?? 'Admin Action',
      t.userName,
      t.userEmail,
      t.description,
      fmt(t.amount ?? 0, currency),
      t.amountCredits ?? 0,
      t.status,
      new Date(t.createdAt).toLocaleString('en-IN'),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary Cards');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]), 'Billing Ledger');

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Doc2LateX_Billings_${currency}_${Date.now()}.xlsx"`,
      },
    });
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
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
    const logoBase64 = getLogoBase64(); // server-side fs read

    const doc = new jsPDF({ orientation: 'landscape' }); // landscape = more columns space
    const pw = doc.internal.pageSize.width;

    // ── Header
    drawPdfHeader(doc, `BILLINGS & PAYMENTS ADMINISTRATIVE REPORT  (${currency})`, primary, logoBase64);

    // ── Summary metrics table
    autoTable(doc, {
      head: [['Metric', 'Value', 'Description']],
      body: [
        ['Monthly Revenue',       fmt(metrics.monthlyRevenue, currency),    `Localized revenue in ${currency}`],
        ['Successful Checkouts',  `${metrics.successfulCheckoutsCount}`,    `Avg value: ${fmt(metrics.averageOrderValue, currency)}`],
        ['Total Points Credited', `${metrics.totalPointsCredited.toLocaleString()} Pts`, 'Recharge & admin credits'],
        ['Refunds Paid / Pending', `${fmt(metrics.totalRefunds, currency)} / ${fmt(metrics.pendingRefunds, currency)}`, 'Processed vs. pipeline'],
        ['Failed Transactions',   `${metrics.failedPaymentsCount} Txns`,   `Total failed: ${fmt(metrics.failedPaymentsAmount, currency)}`],
        ['Renewed / Churned',     `${metrics.renewedCount} / ${metrics.churnedCount}`, 'Renewals vs. expired accounts'],
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
        0: { fontStyle: 'bold', cellWidth: 55 },
        1: { cellWidth: 55, halign: 'right' },
        2: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    });

    // ── Transaction ledger title
    const y1 = ((doc as any).lastAutoTable?.finalY ?? 100) + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('TRANSACTION LEDGER DETAILS', 14, y1);

    // ── Transactions table — no \n in cells, separate columns for name/email
    autoTable(doc, {
      head: [['Txn ID', 'Name', 'Email', 'Description', `Amount (${sym})`, 'Credits', 'Status', 'Date']],
      body: transactions.map((t: any) => [
        t.id.slice(0, 12) + '…',
        t.userName || 'Unknown',
        t.userEmail || 'N/A',
        (t.description || 'N/A').slice(0, 28),
        fmt(t.amount ?? 0, currency),
        `${t.amountCredits ?? 0}`,
        t.status,
        new Date(t.createdAt).toLocaleDateString('en-IN'),
      ]),
      startY: y1 + 4,
      theme: 'grid',
      tableWidth: pw - 28,
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [71, 85, 105],
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        overflow: 'ellipsize',
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'italic' },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 45 },
        4: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: primary },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 22, halign: 'center' },
        7: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: 14, right: 14, bottom: 28 },
    });

    // ── Footer on every page
    drawPdfFooter(doc, primary);

    const pdfBuf = new Uint8Array(doc.output('arraybuffer'));
    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Doc2LateX_Billings_${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
}
