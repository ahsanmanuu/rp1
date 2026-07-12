import nodemailer from "nodemailer";

const COMPANY = {
  name: "Latexify Studio",
  tagline: "Professional LaTeX Editorial for Researchers",
  website: "www.latexify.io",
  email: "contact@latexify.io",
  phone: "+91 9999999999",
  address: "Bangalore, Karnataka, India",
  logoUrl: "https://rp-18pf.onrender.com/logo.png",
};

async function getSmtpConfig() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      username: process.env.SMTP_USER,
      password: process.env.SMTP_PASS,
    };
  }

  try {
    const { pbAdmin } = await import("./pb");
    const pb = await pbAdmin();
    const settings = await pb.settings.getAll();
    if (settings?.smtp?.enabled && settings.smtp.host && settings.smtp.username && settings.smtp.password) {
      return {
        host: settings.smtp.host,
        port: settings.smtp.port || 587,
        username: settings.smtp.username,
        password: settings.smtp.password,
      };
    }
  } catch (err: any) {
    console.warn("[EmailService] Failed to fetch SMTP config from PocketBase:", err.message);
  }
  return null;
}

function getTransporter(config: any, preferredPort?: number) {
  if (!config) return null;
  const port = preferredPort || config.port || 587;

  return nodemailer.createTransport({
    host: config.host,
    port,
    secure: port === 465,
    auth: {
      user: config.username,
      pass: config.password,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function greeting(name?: string | null): string {
  if (!name || name === "User") return "Dear User";
  return `Dear ${name}`;
}

function emailWrapper(contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header with Logo -->
    <div style="background:linear-gradient(135deg,#00685F,#008D81);padding:32px 40px;text-align:center;">
      <img src="${COMPANY.logoUrl}" alt="Latexify Studio" style="max-width:200px;height:auto;margin-bottom:8px;" />
      <p style="color:rgba(255,255,255,0.85);font-size:12px;margin:0;letter-spacing:0.1em;text-transform:uppercase;">${COMPANY.tagline}</p>
    </div>

    <!-- Body Content -->
    <div style="padding:40px;">
      ${contentHtml}
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:32px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#00685F;">${COMPANY.name}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${COMPANY.address}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
        <a href="mailto:${COMPANY.email}" style="color:#00685F;text-decoration:none;">${COMPANY.email}</a>
        &nbsp;|&nbsp;
        <a href="tel:${COMPANY.phone}" style="color:#00685F;text-decoration:none;">${COMPANY.phone}</a>
      </p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
        <a href="https://${COMPANY.website}" style="color:#00685F;text-decoration:none;">${COMPANY.website}</a>
      </p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated email from ${COMPANY.name}. Please do not reply directly.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#334155;font-weight:600;">Yours sincerely,<br/>Latexify Admin</p>
    </div>
  </div>
</body>
</html>`;
}

function ticketEmailWrapper(heading: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#00685F,#008D81);padding:32px 40px;text-align:center;">
      <img src="${COMPANY.logoUrl}" alt="Latexify Studio" style="max-width:200px;height:auto;margin-bottom:8px;" />
      <p style="color:rgba(255,255,255,0.85);font-size:14px;font-weight:600;margin:4px 0 0;">${heading}</p>
    </div>
    <div style="padding:40px;">
      ${bodyHtml}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:32px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#00685F;">${COMPANY.name}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${COMPANY.address}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
        <a href="mailto:${COMPANY.email}" style="color:#00685F;text-decoration:none;">${COMPANY.email}</a>
        &nbsp;|&nbsp;
        <a href="tel:${COMPANY.phone}" style="color:#00685F;text-decoration:none;">${COMPANY.phone}</a>
      </p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated email from ${COMPANY.name}. Please do not reply directly.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#334155;font-weight:600;">Regards,<br/>Latexify Admin</p>
    </div>
  </div>
</body>
</html>`;
}

interface SendEmailOpts {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  emailType: string;
  userId?: string | null;
}

async function logEmail(opts: SendEmailOpts, status: string, errorMsg?: string) {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.emailLog.create({
      data: {
        to: opts.to,
        toName: opts.toName || null,
        subject: opts.subject,
        body: opts.html,
        emailType: opts.emailType,
        status,
        userId: opts.userId || null,
        errorMsg: errorMsg || null,
      },
    });
  } catch (err: any) {
    console.warn("[EmailService] Failed to log email:", err.message);
  }
}

export async function sendEmail(opts: SendEmailOpts): Promise<string | null> {
  const config = await getSmtpConfig();
  const fromEmail = config?.username || process.env.SMTP_USER || "";

  // 1. High-reliability HTTP-based Resend support (bypasses SMTP port blocking on Render free tier)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    console.log(`[EmailService] Sending ${opts.emailType} to ${opts.to} via Resend API`);
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);

      // Resend sandbox only allows sending from onboarding@resend.dev unless domain is verified
      let fromAddress = fromEmail;
      if (fromAddress.includes("gmail.com") && !process.env.RESEND_DOMAIN_VERIFIED) {
        fromAddress = "onboarding@resend.dev";
      }

      const from = `"${COMPANY.name}" <${fromAddress}>`;

      const response = await resend.emails.send({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`[EmailService] Email sent successfully via Resend! ID: ${response.data?.id}`);
      await logEmail(opts, "sent");
      return null;
    } catch (err: any) {
      console.error(`[EmailService] Resend FAILED to send ${opts.emailType} to ${opts.to}:`, err.message);
      await logEmail(opts, "failed", err.message);
      throw err;
    }
  }

  // 2. Standard Nodemailer SMTP fallback
  const preferredPort = config?.port || parseInt(process.env.SMTP_PORT || "587", 10);
  const fallbackPort = preferredPort === 465 ? 587 : 465;
  const from = `"${COMPANY.name}" <${fromEmail}>`;

  console.log(`[EmailService] Sending ${opts.emailType} to ${opts.to} via SMTP (port ${preferredPort})`);

  async function attemptSend(port: number): Promise<string | null> {
    const transporter = getTransporter(config, port);
    if (!transporter) {
      console.log(`[EMAIL STUB] ${opts.emailType} → ${opts.to}: ${opts.subject}`);
      await logEmail(opts, "sent");
      return null;
    }

    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const info = await transporter.sendMail({
          from,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
        });
        console.log(`[EmailService] Email sent successfully via port ${port}! MessageID: ${info.messageId}`);
        await logEmail(opts, "sent");

        if (!process.env.SMTP_USER && !process.env.SMTP_PASS) {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) return previewUrl;
        }

        return null;
      } catch (err: any) {
        const isTransient =
          err.code === "ETIMEDOUT" ||
          err.code === "ECONNRESET" ||
          err.code === "ECONNREFUSED" ||
          err.code === "EAI_AGAIN" ||
          err.code === "ENOTFOUND" ||
          (err.command && err.command === "CONN");

        console.error(`[EmailService] FAILED on port ${port} (attempt ${attempt}/${MAX_RETRIES}):`, err.message);
        if (err.code) console.error(`[EmailService] Error code: ${err.code}`);
        if (err.command) console.error(`[EmailService] SMTP command: ${err.command}`);

        if (isTransient && attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[EmailService] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw err;
      }
    }

    return null;
  }

  try {
    return await attemptSend(preferredPort);
  } catch (err: any) {
    const isPortBlocked =
      err.code === "ETIMEDOUT" ||
      err.code === "ECONNREFUSED" ||
      (err.command && err.command === "CONN");

    if (isPortBlocked) {
      console.log(`[EmailService] Port ${preferredPort} failed, falling back to port ${fallbackPort}...`);
      try {
        return await attemptSend(fallbackPort);
      } catch (fallbackErr: any) {
        await logEmail(opts, "failed", `Port ${preferredPort}: ${err.message} | Port ${fallbackPort}: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    }

    await logEmail(opts, "failed", err.message);
    throw err;
  }
}

// ─── Recovery Email ─────────────────────────────────────────────────────────
export async function sendRecoveryEmail(
  email: string,
  link: string,
  userName?: string | null,
  userId?: string | null
): Promise<string | null> {
  const html = emailWrapper(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${greeting(userName)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      We received a request to restore access to your Latexify workspace. If you did not initiate this, please ignore this email.
    </p>
    <div style="text-align:center;margin:40px 0;">
      <a href="${link}" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:16px 32px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;box-shadow:0 10px 25px -5px rgba(0,104,95,0.3);">
        Establish New Credentials
      </a>
    </div>
    <p style="font-size:13px;color:#94a3b8;text-align:center;margin-top:40px;">
      This link will expire in 1 hour. For your security, do not share this link with anyone.
    </p>
  `);

  return sendEmail({
    to: email,
    toName: userName,
    subject: "Restore Your Latexify Access — Latexify Studio",
    html,
    emailType: "recovery",
    userId,
  });
}

// ─── Blacklist Email ────────────────────────────────────────────────────────
export async function sendBlacklistEmail(
  userEmail: string,
  userName: string,
  reason?: string,
  userId?: string | null
): Promise<string | null> {
  const reasonText = reason || "Violation of platform terms of service.";
  const html = emailWrapper(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${greeting(userName)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      We regret to inform you that your account on <strong>Latexify Studio</strong> has been suspended. Your access to the platform has been temporarily restricted pending review.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0 0 6px;font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Reason for Suspension</p>
      <p style="margin:0;color:#991b1b;font-size:14px;font-weight:500;">${reasonText}</p>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#64748b;margin-bottom:16px;">
      If you believe this action was taken in error, or you wish to appeal this decision, please contact our admin team at <a href="mailto:${COMPANY.email}" style="color:#00685F;font-weight:600;">${COMPANY.email}</a>.
    </p>
  `);

  return sendEmail({
    to: userEmail,
    toName: userName,
    subject: "Important: Your Latexify Account Has Been Suspended",
    html,
    emailType: "blacklist",
    userId,
  });
}

// ─── Reactivation Email ─────────────────────────────────────────────────────
export async function sendReactivationEmail(
  userEmail: string,
  userName: string,
  userId?: string | null
): Promise<string | null> {
  const html = emailWrapper(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${greeting(userName)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      Great news! Your <strong>Latexify Studio</strong> account has been reviewed and your access has been fully restored. You can now log in and continue using the platform.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;color:#166534;font-size:14px;font-weight:500;">
        Full platform access restored<br>
        All your projects and data remain intact<br>
        Your subscription status is unchanged
      </p>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#64748b;margin-bottom:16px;">
      If you have any questions, feel free to contact us at <a href="mailto:${COMPANY.email}" style="color:#00685F;font-weight:600;">${COMPANY.email}</a>.
    </p>
  `);

  return sendEmail({
    to: userEmail,
    toName: userName,
    subject: "Good News: Your Latexify Account Has Been Reactivated",
    html,
    emailType: "reactivation",
    userId,
  });
}

// ─── Expiry Reminder Email ──────────────────────────────────────────────────
export async function sendExpiryReminderEmail(
  email: string,
  daysLeft: number,
  expiryDateStr: string,
  userName?: string | null,
  userId?: string | null
): Promise<string | null> {
  const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard?upgrade=true`;
  const html = emailWrapper(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${greeting(userName)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:16px;">
      Your Latexify Premium access is scheduled to expire in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong> (on <strong>${expiryDateStr}</strong>).
    </p>
    <p style="font-size:14px;line-height:1.6;color:#64748b;margin-bottom:32px;">
      To avoid disruption of your LaTeX compilation pipelines and AI-assisted reviews, renew your subscription plan.
    </p>
    <div style="text-align:center;margin:40px 0;">
      <a href="${dashboardUrl}" style="background:linear-gradient(135deg,#e11d48,#be123c);color:white;padding:16px 32px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;box-shadow:0 10px 25px -5px rgba(225,29,72,0.3);">
        Renew Premium Access
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    toName: userName,
    subject: `Your Premium Latexify Access Expires in ${daysLeft} Day${daysLeft > 1 ? "s" : ""} — Latexify Studio`,
    html,
    emailType: "expiry_reminder",
    userId,
  });
}

// ─── Ticket Created Email ───────────────────────────────────────────────────
export async function sendTicketCreatedEmail(
  userEmail: string,
  userName: string,
  ticketSubject: string,
  ticketId: string,
  userId?: string | null
): Promise<string | null> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const html = ticketEmailWrapper("Ticket Received", `
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${greeting(userName)},
    </p>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin-bottom:12px;">
      We've received your support ticket and our team will review it shortly.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Subject:</strong> ${ticketSubject}</p>
      <p style="margin:0;font-size:13px;color:#64748b;"><strong>Ticket ID:</strong> ${ticketId}</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${baseUrl}/dashboard/support" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 8px 20px -4px rgba(0,104,95,0.3);">
        View Ticket
      </a>
    </div>
  `);

  return sendEmail({
    to: userEmail,
    toName: userName,
    subject: `Ticket Received: ${ticketSubject} — ${ticketId}`,
    html,
    emailType: "ticket_created",
    userId,
  });
}

// ─── Ticket Status Update Email ─────────────────────────────────────────────
export async function sendTicketStatusEmail(
  userEmail: string,
  userName: string,
  ticketSubject: string,
  ticketId: string,
  newStatus: string,
  userId?: string | null
): Promise<string | null> {
  const statusLabel = newStatus === "resolved" ? "Resolved" : newStatus === "in_progress" ? "In Progress" : "Open";
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const html = ticketEmailWrapper("Support Ticket Update", `
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${greeting(userName)},
    </p>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin-bottom:12px;">
      Your support ticket has been updated to <strong>${statusLabel}</strong>.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Subject:</strong> ${ticketSubject}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Ticket ID:</strong> ${ticketId}</p>
      <p style="margin:0;font-size:13px;color:#64748b;"><strong>Status:</strong> ${statusLabel}</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${baseUrl}/dashboard/support" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 8px 20px -4px rgba(0,104,95,0.3);">
        View Ticket
      </a>
    </div>
  `);

  return sendEmail({
    to: userEmail,
    toName: userName,
    subject: `Ticket Update: ${ticketSubject} — ${statusLabel} — ${ticketId}`,
    html,
    emailType: "ticket_status",
    userId,
  });
}

// ─── Ticket Reply Email ─────────────────────────────────────────────────────
export async function sendTicketReplyEmail(
  userEmail: string,
  userName: string,
  ticketSubject: string,
  ticketId: string,
  replyText: string,
  userId?: string | null
): Promise<string | null> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const html = ticketEmailWrapper("New Reply on Your Ticket", `
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${greeting(userName)},
    </p>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin-bottom:12px;">
      Our support team has replied to your ticket.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Subject:</strong> ${ticketSubject}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Ticket ID:</strong> ${ticketId}</p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0;" />
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">"${replyText}"</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${baseUrl}/dashboard/support" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 8px 20px -4px rgba(0,104,95,0.3);">
        View Ticket
      </a>
    </div>
  `);

  return sendEmail({
    to: userEmail,
    toName: userName,
    subject: `New Reply: ${ticketSubject} — ${ticketId}`,
    html,
    emailType: "ticket_reply",
    userId,
  });
}
