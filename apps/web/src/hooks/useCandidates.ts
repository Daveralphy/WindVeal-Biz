import { create } from 'zustand';
import api from '@/lib/api';
import { Candidate } from '@/types';

interface CandidatesState {
  candidates: Candidate[];
  currentCandidate: Candidate | null;
  isLoading: boolean;
  error: string | null;
  fetchCandidates: (jobId: string) => Promise<void>;
  fetchCandidate: (id: string) => Promise<void>;
  updateStage: (id: string, stage: string) => Promise<void>;
  uploadResume: (jobId: string, file: File) => Promise<void>;
}

export const useCandidates = create<CandidatesState>((set, get) => ({
  candidates: [],
  currentCandidate: null,
  isLoading: false,
  error: null,

  fetchCandidates: async (jobId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/jobs/${jobId}/candidates`);
      set({ candidates: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch candidates', isLoading: false });
    }
  },

  fetchCandidate: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/candidates/${id}`);
      set({ currentCandidate: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch candidate', isLoading: false });
    }
  },

  updateStage: async (id, stage) => {
    // Optimistic update
    const previousCandidates = get().candidates;
    set((state) => ({
      candidates: state.candidates.map((c) => 
        c.id === id ? { ...c, stage: stage as any } : c
      )
    }));

    try {
      await api.put(`/candidates/${id}/stage`, { stage });
    } catch (error: any) {
      // Revert on error
      set({ candidates: previousCandidates, error: error.message });
    }
  },

  uploadResume: async (jobId, file) => {
    set({ isLoading: true, error: null });
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await api.post(`/jobs/${jobId}/candidates`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set((state) => ({
        candidates: [...state.candidates, response.data],
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to upload resume', isLoading: false });
      throw error;
    }
  },
}));