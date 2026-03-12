import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import prisma from '../lib/prisma.js';
import crypto from 'node:crypto';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName?: string;
  fromEmail?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
}

/**
 * Build an SMTP transporter from org-level settings or fallback env vars.
 */
function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    family: 4, // force IPv4 — avoids ENETUNREACH on networks without IPv6
    auth: {
      user: config.user,
      pass: config.pass,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

/**
 * Resolve SMTP config:  org settings first → env fallback
 */
export function resolveSmtpConfig(orgSmtp: SmtpConfig | null | undefined): SmtpConfig | null {
  if (orgSmtp?.host && orgSmtp?.user && orgSmtp?.pass) {
    return orgSmtp;
  }

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      fromName: undefined,
      fromEmail: env.SMTP_FROM,
    };
  }

  return null;
}

/**
 * Send an email via SMTP.
 * Returns true on success, throws on failure.
 */
export async function sendEmail(
  smtpConfig: SmtpConfig,
  options: SendEmailOptions,
): Promise<{ messageId: string }> {
  const transport = createTransport(smtpConfig);

  const fromName = options.fromName || smtpConfig.fromName || 'Hiring Team';
  const fromEmail = options.fromEmail || smtpConfig.fromEmail || smtpConfig.user;

  const info = await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  return { messageId: info.messageId };
}

/**
 * Verify SMTP credentials are valid.
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<boolean> {
  const transport = createTransport(config);
  await transport.verify();
  return true;
}

// ─── System Email (no org context) ─────────────────────

async function getSystemSmtp(): Promise<SmtpConfig | null> {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      fromEmail: env.SMTP_FROM,
    };
  }
  return null;
}

export async function sendSystemEmail(to: string, subject: string, html: string): Promise<boolean> {
  const cfg = await getSystemSmtp();
  if (!cfg) {
    console.warn(`[Email] No system SMTP configured — cannot send to ${to}`);
    return false;
  }
  try {
    const transport = createTransport(cfg);
    const fromEmail = cfg.fromEmail ?? cfg.user;
    const fromName = env.SMTP_FROM_NAME;
    await transport.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, html });
    return true;
  } catch (err) {
    console.error('[Email] System email failed:', err);
    return false;
  }
}

// ─── Verification Code Helpers ──────────────────────────

export function generateCode6(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function createVerificationCode(email: string, type: string): Promise<string> {
  // Invalidate old codes of same type + email
  await prisma.verificationCode.updateMany({
    where: { email, type, used: false },
    data: { used: true },
  });
  const code = generateCode6();
  await prisma.verificationCode.create({
    data: { email, code, type, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  return code;
}

export async function validateVerificationCode(email: string, code: string, type: string): Promise<boolean> {
  const record = await prisma.verificationCode.findFirst({
    where: { email, code, type, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return false;
  await prisma.verificationCode.update({ where: { id: record.id }, data: { used: true } });
  return true;
}

export function verificationEmailHtml(code: string, purpose: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#111;margin-bottom:8px;">Your verification code</h2>
      <p style="color:#555;margin-bottom:24px;">${purpose}</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111;">${code}</span>
      </div>
      <p style="color:#999;font-size:13px;margin-top:24px;">This code expires in 15 minutes. Do not share it with anyone.</p>
    </div>
  `;
}

// ─── Team Invite Email ──────────────────────────────────

export function inviteEmailHtml(opts: {
  inviterName: string;
  orgName: string;
  role: string;
  message?: string;
  acceptUrl: string;
}): string {
  const roleLabel: Record<string, string> = {
    RECRUITER: 'Recruiter',
    HIRING_MANAGER: 'Hiring Manager',
    INTERVIEWER: 'Interviewer',
    VIEWER: 'Viewer',
    ADMIN: 'Admin',
  };
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
      <h2 style="color:#111;margin-bottom:8px;">You're invited to join ${opts.orgName}</h2>
      <p style="color:#555;margin-bottom:4px;">
        <strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.orgName}</strong> on VealBiz
        as a <strong>${roleLabel[opts.role] ?? opts.role}</strong>.
      </p>
      ${opts.message ? `<p style="color:#555;margin:16px 0;padding:12px 16px;border-left:3px solid #e5e7eb;font-style:italic;">${opts.message}</p>` : ''}
      <p style="color:#555;margin-bottom:24px;">Click the button below to accept your invitation and set up your account.</p>
      <a href="${opts.acceptUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Accept Invitation
      </a>
      <p style="color:#999;font-size:13px;margin-top:24px;">
        This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.
      </p>
      <p style="color:#bbb;font-size:12px;margin-top:8px;">
        Or copy this link: <a href="${opts.acceptUrl}" style="color:#6366f1;">${opts.acceptUrl}</a>
      </p>
    </div>
  `;
}

