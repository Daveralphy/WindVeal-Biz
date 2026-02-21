import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  organizationName: z.string().min(2),
  firstName: z.string(),
  lastName: z.string(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const createJobSchema = z.object({
  title: z.string().min(2),
  department: z.string(),
  location: z.string(),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  description: z.string(),
  requirements: z.string(),
  status: z.enum(['ACTIVE', 'CLOSED', 'DRAFT']).optional(),
});

export const updateStageSchema = z.object({
  stage: z.enum(['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']),
});