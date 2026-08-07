"use strict";exports.id=5070,exports.ids=[5070],exports.modules={95070:(a,b,c)=>{c.d(b,{Ao:()=>n,Bw:()=>p,Lc:()=>q,ON:()=>o,To:()=>r,W2:()=>l,Ym:()=>m,fs:()=>s});var d=c(35924);let e={name:"Latexify Studio",tagline:"Professional LaTeX Editorial for Researchers",website:"www.latexify.io",email:"contact@latexify.io",phone:"+91 9999999999",address:"Bangalore, Karnataka, India",logoUrl:`${"http://localhost:3000".replace(/\/+$/,"")}/logo.png`};async function f(){if(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS)return{host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587",10),username:process.env.SMTP_USER,password:process.env.SMTP_PASS};try{let{pbAdmin:a}=await Promise.resolve().then(c.bind(c,41480)),b=await a(),d=await b.settings.getAll();if(d?.smtp?.enabled&&d.smtp.host&&d.smtp.username&&d.smtp.password)return{host:d.smtp.host,port:d.smtp.port||587,username:d.smtp.username,password:d.smtp.password}}catch(a){console.warn("[EmailService] Failed to fetch SMTP config from PocketBase:",a.message)}return null}function g(a){return a&&"User"!==a?`Dear ${a}`:"Dear User"}function h(a){return`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header with Logo -->
    <div style="background:linear-gradient(135deg,#00685F,#008D81);padding:32px 40px;text-align:center;">
      <img src="${e.logoUrl}" alt="Latexify Studio" style="max-width:200px;height:auto;margin-bottom:8px;" />
      <p style="color:rgba(255,255,255,0.85);font-size:12px;margin:0;letter-spacing:0.1em;text-transform:uppercase;">${e.tagline}</p>
    </div>

    <!-- Body Content -->
    <div style="padding:40px;">
      ${a}
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:32px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#00685F;">${e.name}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${e.address}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
        <a href="mailto:${e.email}" style="color:#00685F;text-decoration:none;">${e.email}</a>
        &nbsp;|&nbsp;
        <a href="tel:${e.phone}" style="color:#00685F;text-decoration:none;">${e.phone}</a>
      </p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
        <a href="https://${e.website}" style="color:#00685F;text-decoration:none;">${e.website}</a>
      </p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated email from ${e.name}. Please do not reply directly.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#334155;font-weight:600;">Yours sincerely,<br/>Latexify Admin</p>
    </div>
  </div>
</body>
</html>`}function i(a,b){return`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#00685F,#008D81);padding:32px 40px;text-align:center;">
      <img src="${e.logoUrl}" alt="Latexify Studio" style="max-width:200px;height:auto;margin-bottom:8px;" />
      <p style="color:rgba(255,255,255,0.85);font-size:14px;font-weight:600;margin:4px 0 0;">${a}</p>
    </div>
    <div style="padding:40px;">
      ${b}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:32px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#00685F;">${e.name}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${e.address}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">
        <a href="mailto:${e.email}" style="color:#00685F;text-decoration:none;">${e.email}</a>
        &nbsp;|&nbsp;
        <a href="tel:${e.phone}" style="color:#00685F;text-decoration:none;">${e.phone}</a>
      </p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated email from ${e.name}. Please do not reply directly.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#334155;font-weight:600;">Regards,<br/>Latexify Admin</p>
    </div>
  </div>
</body>
</html>`}async function j(a,b,d){try{let{prisma:e}=await c.e(3061).then(c.bind(c,93061));await e.emailLog.create({data:{to:a.to,toName:a.toName||null,subject:a.subject,body:a.html,emailType:a.emailType,status:b,userId:a.userId||null,errorMsg:d||null}})}catch(a){console.warn("[EmailService] Failed to log email:",a.message)}}async function k(a){let b=await f(),g=b?.username||process.env.SMTP_USER||"",h=process.env.RESEND_API_KEY;if(h){console.log(`[EmailService] Sending ${a.emailType} to ${a.to} via Resend API`);try{let{Resend:b}=await c.e(765).then(c.bind(c,60765)),d=new b(h),f=g;f.includes("gmail.com")&&!process.env.RESEND_DOMAIN_VERIFIED&&(f="onboarding@resend.dev");let i=`"${e.name}" <${f}>`,k=await d.emails.send({from:i,to:a.to,subject:a.subject,html:a.html});if(k.error)throw Error(k.error.message);return console.log(`[EmailService] Email sent successfully via Resend! ID: ${k.data?.id}`),await j(a,"sent"),null}catch(b){throw console.error(`[EmailService] Resend FAILED to send ${a.emailType} to ${a.to}:`,b.message),await j(a,"failed",b.message),b}}let i=b?.port||parseInt(process.env.SMTP_PORT||"587",10),k=465===i?587:465,l=`"${e.name}" <${g}>`;async function m(c){let e=function(a,b){if(!a)return null;let c=b||a.port||587;return d.createTransport({host:a.host,port:c,secure:465===c,auth:{user:a.username,pass:a.password},tls:{rejectUnauthorized:!1},connectionTimeout:15e3,greetingTimeout:1e4,socketTimeout:2e4})}(b,c);if(!e)return console.log(`[EMAIL STUB] ${a.emailType} → ${a.to}: ${a.subject}`),await j(a,"sent"),null;for(let b=1;b<=3;b++)try{let b=await e.sendMail({from:l,to:a.to,subject:a.subject,html:a.html});if(console.log(`[EmailService] Email sent successfully via port ${c}! MessageID: ${b.messageId}`),await j(a,"sent"),!process.env.SMTP_USER&&!process.env.SMTP_PASS){let a=d.getTestMessageUrl(b);if(a)return a}break}catch(d){let a="ETIMEDOUT"===d.code||"ECONNRESET"===d.code||"ECONNREFUSED"===d.code||"EAI_AGAIN"===d.code||"ENOTFOUND"===d.code||d.command&&"CONN"===d.command;if(console.error(`[EmailService] FAILED on port ${c} (attempt ${b}/3):`,d.message),d.code&&console.error(`[EmailService] Error code: ${d.code}`),d.command&&console.error(`[EmailService] SMTP command: ${d.command}`),a&&b<3){let a=2e3*Math.pow(2,b-1);console.log(`[EmailService] Retrying in ${a}ms...`),await new Promise(b=>setTimeout(b,a));continue}throw d}return null}console.log(`[EmailService] Sending ${a.emailType} to ${a.to} via SMTP (port ${i})`);try{return await m(i)}catch(b){if("ETIMEDOUT"===b.code||"ECONNREFUSED"===b.code||b.command&&"CONN"===b.command){console.log(`[EmailService] Port ${i} failed, falling back to port ${k}...`);try{return await m(k)}catch(c){throw await j(a,"failed",`Port ${i}: ${b.message} | Port ${k}: ${c.message}`),c}}throw await j(a,"failed",b.message),b}}async function l(a,b,c,d){let e=h(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(c)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      We received a request to restore access to your Latexify workspace. If you did not initiate this, please ignore this email.
    </p>
    <div style="text-align:center;margin:40px 0;">
      <a href="${b}" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:16px 32px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;box-shadow:0 10px 25px -5px rgba(0,104,95,0.3);">
        Establish New Credentials
      </a>
    </div>
    <p style="font-size:13px;color:#94a3b8;text-align:center;margin-top:40px;">
      This link will expire in 1 hour. For your security, do not share this link with anyone.
    </p>
  `);return k({to:a,toName:c,subject:"Restore Your Latexify Access — Latexify Studio",html:e,emailType:"recovery",userId:d})}async function m(a,b,c,d){let f=h(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(b)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      We regret to inform you that your account on <strong>Latexify Studio</strong> has been suspended. Your access to the platform has been temporarily restricted pending review.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0 0 6px;font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Reason for Suspension</p>
      <p style="margin:0;color:#991b1b;font-size:14px;font-weight:500;">${c||"Violation of platform terms of service."}</p>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#64748b;margin-bottom:16px;">
      If you believe this action was taken in error, or you wish to appeal this decision, please contact our admin team at <a href="mailto:${e.email}" style="color:#00685F;font-weight:600;">${e.email}</a>.
    </p>
  `);return k({to:a,toName:b,subject:"Important: Your Latexify Account Has Been Suspended",html:f,emailType:"blacklist",userId:d})}async function n(a,b,c){let d=h(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(b)},
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
      If you have any questions, feel free to contact us at <a href="mailto:${e.email}" style="color:#00685F;font-weight:600;">${e.email}</a>.
    </p>
  `);return k({to:a,toName:b,subject:"Good News: Your Latexify Account Has Been Reactivated",html:d,emailType:"reactivation",userId:c})}async function o(a,b,c,d,e){let f=`${process.env.NEXTAUTH_URL||"http://localhost:3000"}/dashboard?upgrade=true`,i=h(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(d)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:16px;">
      Your Latexify Premium access is scheduled to expire in <strong>${b} day${b>1?"s":""}</strong> (on <strong>${c}</strong>).
    </p>
    <p style="font-size:14px;line-height:1.6;color:#64748b;margin-bottom:32px;">
      To avoid disruption of your LaTeX compilation pipelines and AI-assisted reviews, renew your subscription plan.
    </p>
    <div style="text-align:center;margin:40px 0;">
      <a href="${f}" style="background:linear-gradient(135deg,#e11d48,#be123c);color:white;padding:16px 32px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;box-shadow:0 10px 25px -5px rgba(225,29,72,0.3);">
        Renew Premium Access
      </a>
    </div>
  `);return k({to:a,toName:d,subject:`Your Premium Latexify Access Expires in ${b} Day${b>1?"s":""} — Latexify Studio`,html:i,emailType:"expiry_reminder",userId:e})}async function p(a,b,c,d,e){let f=`${process.env.NEXTAUTH_URL||"http://localhost:3000"}/dashboard?upgrade=true`,i=h(`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(d)},
    </p>
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:16px;">
      Your Premium AI Plan access is scheduled to expire in <strong>${b} day${b>1?"s":""}</strong> (on <strong>${c}</strong>).
    </p>
    <p style="font-size:14px;line-height:1.6;color:#64748b;margin-bottom:32px;">
      To avoid losing access to unlimited daily tokens and high-priority AI-assisted reviews, renew your AI plan now.
    </p>
    <div style="text-align:center;margin:40px 0;">
      <a href="${f}" style="background:linear-gradient(135deg,#e11d48,#be123c);color:white;padding:16px 32px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;box-shadow:0 10px 25px -5px rgba(225,29,72,0.3);">
        Renew AI Plan
      </a>
    </div>
  `);return k({to:a,toName:d,subject:`Your Premium AI Plan Expires in ${b} Day${b>1?"s":""} — Latexify Studio`,html:i,emailType:"expiry_reminder",userId:e})}async function q(a,b,c,d,e){let f=process.env.NEXTAUTH_URL||"http://localhost:3000",h=i("Ticket Received",`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(b)},
    </p>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin-bottom:12px;">
      We've received your support ticket and our team will review it shortly.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Subject:</strong> ${c}</p>
      <p style="margin:0;font-size:13px;color:#64748b;"><strong>Ticket ID:</strong> ${d}</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${f}/dashboard/support" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 8px 20px -4px rgba(0,104,95,0.3);">
        View Ticket
      </a>
    </div>
  `);return k({to:a,toName:b,subject:`Ticket Received: ${c} — ${d}`,html:h,emailType:"ticket_created",userId:e})}async function r(a,b,c,d,e,f){let h="resolved"===e?"Resolved":"in_progress"===e?"In Progress":"Open",j=process.env.NEXTAUTH_URL||"http://localhost:3000",l=i("Support Ticket Update",`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(b)},
    </p>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin-bottom:12px;">
      Your support ticket has been updated to <strong>${h}</strong>.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Subject:</strong> ${c}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Ticket ID:</strong> ${d}</p>
      <p style="margin:0;font-size:13px;color:#64748b;"><strong>Status:</strong> ${h}</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${j}/dashboard/support" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 8px 20px -4px rgba(0,104,95,0.3);">
        View Ticket
      </a>
    </div>
  `);return k({to:a,toName:b,subject:`Ticket Update: ${c} — ${h} — ${d}`,html:l,emailType:"ticket_status",userId:f})}async function s(a,b,c,d,e,f){let h=process.env.NEXTAUTH_URL||"http://localhost:3000",j=i("New Reply on Your Ticket",`
    <p style="font-size:16px;line-height:1.6;color:#475569;margin-bottom:24px;">
      ${g(b)},
    </p>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin-bottom:12px;">
      Our support team has replied to your ticket.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Subject:</strong> ${c}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Ticket ID:</strong> ${d}</p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0;" />
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">"${e}"</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${h}/dashboard/support" style="background:linear-gradient(135deg,#00685F,#008D81);color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 8px 20px -4px rgba(0,104,95,0.3);">
        View Ticket
      </a>
    </div>
  `);return k({to:a,toName:b,subject:`New Reply: ${c} — ${d}`,html:j,emailType:"ticket_reply",userId:f})}}};