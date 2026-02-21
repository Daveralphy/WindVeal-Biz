import { User, Job, Candidate } from './index';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  organizationName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CreateJobRequest extends Omit<Job, 'id' | 'createdAt' | 'candidateCount' | 'status'> {
  status?: Job['status'];
}

export interface UpdateJobRequest extends Partial<CreateJobRequest> {}

export interface UpdateCandidateStageRequest {
  stage: Candidate['stage'];
}