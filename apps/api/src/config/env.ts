import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  GROQ_API_KEY: z.string().optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(104857600),
});

export const env = envSchema.parse(process.env);
