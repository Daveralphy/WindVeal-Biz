import { create } from 'zustand';
import api from '@/lib/api';
import { Job } from '@/types';

interface JobsState {
  jobs: Job[];
  currentJob: Job | null;
  isLoading: boolean;
  error: string | null;
  fetchJobs: () => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  createJob: (jobData: Partial<Job>) => Promise<void>;
}

export const useJobs = create<JobsState>((set) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/jobs');
      set({ jobs: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch jobs', isLoading: false });
    }
  },

  fetchJob: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/jobs/${id}`);
      set({ currentJob: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch job', isLoading: false });
    }
  },

  createJob: async (jobData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/jobs', jobData);
      set((state) => ({ 
        jobs: [...state.jobs, response.data],
        isLoading: false 
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to create job', isLoading: false });
      throw error;
    }
  },
}));