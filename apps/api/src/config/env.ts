import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  GROQ_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  APP_URL: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(104857600),

  // SMTP (required for email verification and team invites)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('VealBiz'),

  // OAuth — Google (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // OAuth — Microsoft (optional)
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default('common'),

  // Public API base URL (used for OAuth callback URIs)
  API_URL: z.string().default('http://localhost:8000'),

  // Super admin account (platform-level, created by seed)
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@vealbiz.com'),
  SUPER_ADMIN_USERNAME: z.string().default('vealbiz.admin'),
  SUPER_ADMIN_FIRST_NAME: z.string().default('VealBiz'),
  SUPER_ADMIN_LAST_NAME: z.string().default('Admin'),
  SUPER_ADMIN_PASSWORD: z.string().default('SuperAdmin123!'),

  // Optional test/default org-admin account (only created if email is set)
  SEED_ADMIN_EMAIL: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_FIRST_NAME: z.string().optional(),
  SEED_ADMIN_LAST_NAME: z.string().optional(),
  SEED_ADMIN_USERNAME: z.string().optional(),
  SEED_ADMIN_ORG_NAME: z.string().optional(),
  SEED_ADMIN_ORG_SLUG: z.string().optional(),
});

export const env = envSchema.parse(process.env);
