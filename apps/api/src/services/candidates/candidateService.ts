import prisma from '../../lib/prisma';
import { parseResume } from './resumeParser';
import { rankCandidate } from '../ai/rankingService';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { MultipartFile } from '@fastify/multipart';

export const processCandidateUpload = async (
  file: MultipartFile,
  jobId: string
) => {
  // 1. Save file to disk
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const filename = `${Date.now()}-${file.filename.replace(/\s+/g, '-')}`;
  const filepath = path.join(uploadDir, filename);
  
  await pipeline(file.file, fs.createWriteStream(filepath));
  
  // 2. Read file buffer for parsing
  const fileBuffer = fs.readFileSync(filepath);
  
  // 3. Parse text from PDF/DOCX
  const resumeText = await parseResume(fileBuffer, file.mimetype);
  
  // 4. Get Job details for AI context
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });
  
  if (!job) throw new Error('Job not found');
  
  // 5. AI Analysis & Ranking
  const aiResult = await rankCandidate(
    resumeText,
    `${job.title} - ${job.description} ${job.requirements}`
  );
  
  // 6. Save to DB
  const candidate = await prisma.candidate.create({
    data: {
      name: aiResult.name || 'Unknown Candidate',
      email: aiResult.email || null,
      resumeUrl: filepath,
      jobId,
      score: aiResult.score,
      summary: aiResult.summary,
      skills: aiResult.skills,
      stage: 'APPLIED',
    },
  });
  
  return candidate;
};