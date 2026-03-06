import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

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
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
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
