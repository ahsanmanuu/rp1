// ── Currency System ────────────────────────────────────────────────────────
export interface CurrencyDef { code: string; symbol: string; rate: number; label: string; }
export const CURRENCIES: Record<string, CurrencyDef> = {
    INR: { code: 'INR', symbol: '₹',   rate: 1,       label: '₹ INR — Indian Rupee' },
    USD: { code: 'USD', symbol: '$',    rate: 0.012,   label: '$ USD — US Dollar' },
    EUR: { code: 'EUR', symbol: '€',    rate: 0.011,   label: '€ EUR — Euro' },
    GBP: { code: 'GBP', symbol: '£',   rate: 0.0094,  label: '£ GBP — British Pound' },
    AED: { code: 'AED', symbol: 'د.إ', rate: 0.044,   label: 'د.إ AED — UAE Dirham' },
    SAR: { code: 'SAR', symbol: '﷼',   rate: 0.045,   label: '﷼ SAR — Saudi Riyal' },
    SGD: { code: 'SGD', symbol: 'S$',  rate: 0.016,   label: 'S$ SGD — Singapore Dollar' },
    AUD: { code: 'AUD', symbol: 'A$',  rate: 0.018,   label: 'A$ AUD — Australian Dollar' },
    CAD: { code: 'CAD', symbol: 'C$',  rate: 0.016,   label: 'C$ CAD — Canadian Dollar' },
    JPY: { code: 'JPY', symbol: '¥',   rate: 1.93,    label: '¥ JPY — Japanese Yen' },
};

export const formatCurrencyVal = (inrAmount: number, code: string): string => {
  const cur = CURRENCIES[code] ?? CURRENCIES['INR'];
  const converted = inrAmount * cur.rate;
  const decimals = ['JPY', 'INR'].includes(code) ? 0 : 2;
  return `${cur.symbol}${converted.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

/** Load public image as base64 for PDF rendering in browser */
export const getBase64ImageFromUrl = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

/** Browser-safe file download via anchor click */
const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 200);
};

// Theme primary color helper
const getThemeColor = (theme: 'indigo' | 'emerald' | 'rose'): { primary: [number, number, number] } => {
  if (theme === 'emerald') return { primary: [5, 150, 105] };
  if (theme === 'rose')    return { primary: [225, 29, 72] };
  return { primary: [79, 70, 229] }; // indigo default
};

// Formats membership string
const formatMembership = (m: string) => {
  const map: Record<string, string> = {
    free:        'Free Plan',
    premium_1m:  'Pro Plan (1 Month)',
    premium_3m:  'Pro Plan (3 Months)',
    premium_6m:  'Pro Plan (6 Months)',
    premium_12m: 'Pro Plan (12 Months)',
  };
  return map[m] || m;
};

// ── PDF Header / Footer helpers ───────────────────────────────────────────────

const drawPdfHeader = (
  doc: any,
  title: string,
  themeColor: { primary: [number, number, number] },
  logoBase64?: string
) => {
  const pageWidth = doc.internal.pageSize.width || 210;

  // Top accent bar
  doc.setFillColor(themeColor.primary[0], themeColor.primary[1], themeColor.primary[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');

  let textX = 14;
  if (logoBase64 && logoBase64.length > 50) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 48, 12);
      textX = 66;
    } catch {
      // logo optional — skip silently
    }
  }

  // Company brand
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Latexify Studio', textX, 17);

  // Tagline
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Professional LaTeX Editorial for Researchers', textX, 22);

  // Contact info right-aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Website: www.latexify.io',    pageWidth - 14, 14, { align: 'right' });
  doc.text('Email: contact@latexify.io',  pageWidth - 14, 18, { align: 'right' });
  doc.text('Location: Bangalore, India',  pageWidth - 14, 22, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 26, pageWidth - 14, 26);

  // Document title
  doc.setTextColor(themeColor.primary[0], themeColor.primary[1], themeColor.primary[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), 14, 33);

  // Generation date
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Exported: ${new Date().toLocaleString('en-IN')}`, pageWidth - 14, 33, { align: 'right' });
};

const drawPdfFooter = (doc: any, themeColor: { primary: [number, number, number] }) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth  = doc.internal.pageSize.width  || 210;
  const pageHeight = doc.internal.pageSize.height || 297;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Generated via Latexify Super Admin Console', 14, pageHeight - 11);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 11, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('CONFIDENTIAL - INTERNAL ADMIN USE ONLY', pageWidth / 2, pageHeight - 11, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('© 2026 Latexify Studio. All rights reserved.', pageWidth / 2, pageHeight - 7, { align: 'center' });
  }
};

// ── BILLINGS EXPORTS ─────────────────────────────────────────────────────────

export async function exportBillingsToExcel(
  metrics: any,
  transactions: any[],
  currencyCode: string = 'INR'
) {
  // Dynamic import — works in browser, avoids SSR issues
  const XLSX = await import('xlsx');

  const symbol = CURRENCIES[currencyCode]?.symbol ?? '₹';

  const summaryData = [
    { 'Metric Card': '★ Latexify Studio',              'Value': 'Platform Report',                             'Description': 'Branded Financial Audit Log' },
    { 'Metric Card': 'Report Type',                      'Value': `Billings & Payments (${currencyCode})`,      'Description': `Export Date: ${new Date().toLocaleString('en-IN')}` },
    { 'Metric Card': '---',                              'Value': '---',                                         'Description': '---' },
    { 'Metric Card': 'Monthly Revenue',                  'Value': formatCurrencyVal(metrics.monthlyRevenue || 0, currencyCode),             'Description': `Revenue in ${currencyCode}` },
    { 'Metric Card': 'Successful Checkouts',             'Value': `${metrics.successfulCheckoutsCount || 0} Txns`, 'Description': `Avg value: ${formatCurrencyVal(metrics.averageOrderValue || 0, currencyCode)}` },
    { 'Metric Card': 'Total Points Credit',              'Value': `${(metrics.totalPointsCredited || 0).toLocaleString()} Pts`, 'Description': 'Recharge & admin point credits' },
    { 'Metric Card': 'Refunded to User',                 'Value': formatCurrencyVal(metrics.totalRefunds || 0, currencyCode),               'Description': 'Fully processed refunds' },
    { 'Metric Card': 'Refund Pending',                   'Value': formatCurrencyVal(metrics.pendingRefunds || 0, currencyCode),             'Description': 'Refunds awaiting pipeline' },
    { 'Metric Card': 'Failed Transactions',              'Value': `${metrics.failedPaymentsCount || 0} Txns`,   'Description': `Total failed value: ${formatCurrencyVal(metrics.failedPaymentsAmount || 0, currencyCode)}` },
    { 'Metric Card': 'Total Customers Renewed',          'Value': `${metrics.renewedCount || 0} Accounts`,     'Description': 'Active renewals count' },
    { 'Metric Card': 'Customers Who Did Not Renew',      'Value': `${metrics.churnedCount || 0} Accounts`,     'Description': 'Inactive / expired subscriptions' },
  ];

  const txData = transactions.map((t) => ({
    'Transaction ID':      t.id,
    'Order ID / Ref':      t.orderId || 'Admin Action',
    'Customer Name':       t.userName || 'Unnamed',
    'Customer Email':      t.userEmail || 'N/A',
    'Plan / Description':  t.description || t.planType || 'N/A',
    'Duration (Months)':   t.durationMonths || 'N/A',
    'Points (Credits)':    t.credits || t.amountCredits || 0,
    [`Amount (${symbol})`]: formatCurrencyVal(t.amount ?? t.amountDollars ?? 0, currencyCode),
    'Status':              t.status || 'Completed',
    'Date & Time':         new Date(t.createdAt || t.date).toLocaleString('en-IN'),
  }));

  const wb  = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summaryData);
  const ws2 = XLSX.utils.json_to_sheet(txData);

  XLSX.utils.book_append_sheet(wb, ws1, 'Summary Cards');
  XLSX.utils.book_append_sheet(wb, ws2, 'Billing Ledger');

  // Write to ArrayBuffer then download via Blob — works in all browsers
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Latexify_Billings_${currencyCode}_${Date.now()}.xlsx`
  );
}

export async function exportBillingsToPDF(
  metrics: any,
  transactions: any[],
  theme: 'indigo' | 'emerald' | 'rose' = 'indigo',
  currencyCode: string = 'INR'
) {
  // jsPDF v4 — use named export { jsPDF }
  const { jsPDF } = await import('jspdf');
  // jspdf-autotable v5 — use named export { autoTable, applyPlugin }
  const { autoTable, applyPlugin } = await import('jspdf-autotable');

  // Register the plugin so internal state tracking works
  applyPlugin(jsPDF);

  const doc = new jsPDF();
  const themeColor = getThemeColor(theme);

  // Load logo (optional — fails gracefully)
  const logoBase64 = await getBase64ImageFromUrl('/logo.png');

  // 1. Header
  drawPdfHeader(doc, `Billings & Payments Report (${currencyCode})`, themeColor, logoBase64);

  // 2. Summary table
  autoTable(doc, {
    head: [['Summary Metric', 'Value', 'Description']],
    body: [
      ['Monthly Revenue',             formatCurrencyVal(metrics.monthlyRevenue || 0, currencyCode),  `Localized to ${currencyCode}`],
      ['Successful Checkouts',        `${metrics.successfulCheckoutsCount || 0} Txns`,               `Avg: ${formatCurrencyVal(metrics.averageOrderValue || 0, currencyCode)}`],
      ['Total Points Credit',         `${(metrics.totalPointsCredited || 0).toLocaleString()} Pts`,  'Recharges & admin credits'],
      ['Refunds Paid / Pending',      `${formatCurrencyVal(metrics.totalRefunds || 0, currencyCode)} / ${formatCurrencyVal(metrics.pendingRefunds || 0, currencyCode)}`, 'Completed vs. pipeline'],
      ['Failed Transactions',         `${metrics.failedPaymentsCount || 0} Txns`,                    `Volume: ${formatCurrencyVal(metrics.failedPaymentsAmount || 0, currencyCode)}`],
      ['Renewed / Churned',           `${metrics.renewedCount || 0} / ${metrics.churnedCount || 0}`,  'Plan renewals vs. expired'],
    ],
    startY: 38,
    theme: 'striped',
    headStyles: { fillColor: themeColor.primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    margin: { left: 14, right: 14 },
  });

  // 3. Transaction ledger heading
  const afterSummary = (doc as any).lastAutoTable?.finalY ?? 120;
  const txTitleY = afterSummary + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('TRANSACTION LEDGER DETAILS', 14, txTitleY);

  // 4. Transactions table
  autoTable(doc, {
    head: [['Txn ID / Ref', 'Customer', 'Plan', 'Credits', `Value (${currencyCode})`, 'Status', 'Date']],
    body: transactions.map((t) => [
      t.id.slice(0, 16) + (t.id.length > 16 ? '…' : ''),
      `${t.userName || 'Unnamed'}\n(${t.userEmail || 'N/A'})`,
      t.description || t.planType || 'N/A',
      `${t.credits || t.amountCredits || 0} Pts`,
      formatCurrencyVal(t.amount ?? t.amountDollars ?? 0, currencyCode),
      t.status || 'Completed',
      new Date(t.createdAt || t.date).toLocaleDateString('en-IN'),
    ]),
    startY: txTitleY + 3,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [71, 85, 105] },
    columnStyles: { 4: { fontStyle: 'bold', textColor: themeColor.primary } },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  // 5. Footer
  drawPdfFooter(doc, themeColor);

  // Download via Blob
  const pdfBlob = doc.output('blob');
  triggerDownload(pdfBlob, `Latexify_Billings_${Date.now()}.pdf`);
}

// ── USERS EXPORTS ────────────────────────────────────────────────────────────

export async function exportUsersToExcel(users: any[]) {
  const XLSX = await import('xlsx');

  const totalCount     = users.length;
  const activeCount    = users.filter(u => u.status !== 'blacklisted').length;
  const abnormalCount  = users.filter(u => u.status === 'abnormal').length;
  const overAccessCount = users.filter(u => u.aiTokensUsed > 50000).length;
  const tempLockedCount = users.filter(u => u.status !== 'blacklisted' && !!(u.blockedUntil && new Date(u.blockedUntil) > new Date())).length;
  const bannedCount    = users.filter(u => u.status === 'blacklisted').length;

  const summaryData = [
    { 'Segment': '★ Latexify Studio',                   'Count': 'User Audit Log',                        'Description': 'Branded Security Directory' },
    { 'Segment': 'Report Type',                            'Count': 'User Directory & Security Audit Report', 'Description': `Export Date: ${new Date().toLocaleString('en-IN')}` },
    { 'Segment': '---',                                    'Count': '---',                                   'Description': '---' },
    { 'Segment': 'Total Registered Users',                 'Count': totalCount,                              'Description': 'All platform accounts' },
    { 'Segment': 'Active Accounts',                        'Count': activeCount,                             'Description': 'Not blacklisted' },
    { 'Segment': 'Abnormal Behavior Flagged',              'Count': abnormalCount,                           'Description': 'Suspicious activity flagged' },
    { 'Segment': 'AI Over-Access (>50k tokens)',           'Count': overAccessCount,                         'Description': 'Heavy AI usage' },
    { 'Segment': 'Temporarily Locked',                     'Count': tempLockedCount,                         'Description': 'Login lockout or rate-limited' },
    { 'Segment': 'Permanently Banned / Blacklisted',       'Count': bannedCount,                             'Description': 'Access permanently revoked' },
  ];

  const userData = users.map((u) => ({
    'User ID':               u.id,
    'Full Name':             u.name || 'Unnamed Scholar',
    'Email Address':         u.email,
    'Role':                  u.role || 'user',
    'Current Status':        u.status || 'active',
    'Membership Tier':       formatMembership(u.membershipRaw || u.membership || 'free'),
    'Membership Expiry':     u.membershipExpiresAt ? new Date(u.membershipExpiresAt).toLocaleString('en-IN') : 'Never / Free Plan',
    'Points Balance':        u.points || 0,
    'AI Tokens Used':        u.aiTokensUsed || 0,
    'Projects Count':        u.projectCount || 0,
    'Last IP Address':       u.lastIp || 'N/A',
    'Last Location':         u.lastLocation || 'N/A',
    'Blacklist Reason':      u.blacklistReason || 'None',
    'Temp Block Until':      u.blockedUntil ? new Date(u.blockedUntil).toLocaleString('en-IN') : 'N/A',
    'Date Registered':       new Date(u.createdAt).toLocaleString('en-IN'),
  }));

  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'User Metrics Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(userData),    'User Directory');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Latexify_Users_${Date.now()}.xlsx`
  );
}

export async function exportUsersToPDF(
  users: any[],
  theme: 'indigo' | 'emerald' | 'rose' = 'indigo'
) {
  const { jsPDF }                  = await import('jspdf');
  const { autoTable, applyPlugin } = await import('jspdf-autotable');

  applyPlugin(jsPDF);

  const doc = new jsPDF();
  const themeColor = getThemeColor(theme);

  const logoBase64 = await getBase64ImageFromUrl('/logo.png');

  const totalCount      = users.length;
  const activeCount     = users.filter(u => u.status !== 'blacklisted').length;
  const abnormalCount   = users.filter(u => u.status === 'abnormal').length;
  const overAccessCount = users.filter(u => u.aiTokensUsed > 50000).length;
  const tempLockedCount = users.filter(u => u.status !== 'blacklisted' && !!(u.blockedUntil && new Date(u.blockedUntil) > new Date())).length;
  const bannedCount     = users.filter(u => u.status === 'blacklisted').length;

  // 1. Header
  drawPdfHeader(doc, 'Platform User Directory & Security Audit Report', themeColor, logoBase64);

  // 2. Summary table
  autoTable(doc, {
    head: [['User Segment', 'Count', 'Description']],
    body: [
      ['Total Registered Users',          `${totalCount}`,      'All platform accounts'],
      ['Active & Sound Accounts',          `${activeCount}`,     'Healthy, not blacklisted'],
      ['Abnormal Activity Flagged',        `${abnormalCount}`,   'Rate-limiting / script access detected'],
      ['AI High Token Access',             `${overAccessCount}`, 'Token usage exceeding 50,000'],
      ['Temporarily Security Locked',      `${tempLockedCount}`, 'Rate-blocked login lockouts'],
      ['Permanently Banned / Suspended',   `${bannedCount}`,     'Access permanently revoked'],
    ],
    startY: 38,
    theme: 'striped',
    headStyles: { fillColor: themeColor.primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    margin: { left: 14, right: 14 },
  });

  // 3. User list heading
  const afterSummary = (doc as any).lastAutoTable?.finalY ?? 120;
  const listTitleY = afterSummary + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PLATFORM USER DIRECTORY', 14, listTitleY);

  // 4. Users table
  autoTable(doc, {
    head: [['Name / Email', 'Tier', 'Pts', 'AI Tokens', 'Proj', 'Status', 'Location / IP', 'Joined']],
    body: users.map((u) => [
      `${u.name || 'Unnamed'}\n(${u.email})`,
      formatMembership(u.membershipRaw || u.membership || 'free'),
      `${u.points || 0}`,
      u.aiTokensUsed > 999 ? `${(u.aiTokensUsed / 1000).toFixed(1)}k` : `${u.aiTokensUsed || 0}`,
      `${u.projectCount || 0}`,
      u.status === 'blacklisted'
        ? 'Banned'
        : (u.blockedUntil && new Date(u.blockedUntil) > new Date())
          ? 'Temp Locked'
          : u.status,
      `${u.lastLocation || 'Unknown'}\n(${u.lastIp || 'N/A'})`,
      new Date(u.createdAt).toLocaleDateString('en-IN'),
    ]),
    startY: listTitleY + 3,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [71, 85, 105] },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  // 5. Footer
  drawPdfFooter(doc, themeColor);

  const pdfBlob = doc.output('blob');
  triggerDownload(pdfBlob, `Latexify_Users_${Date.now()}.pdf`);
}
