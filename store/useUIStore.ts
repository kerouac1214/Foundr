import { create } from 'zustand';
import { BatchProgress } from '../types';

type ViewType = 'context' | 'episodes' | 'storyboard' | 'foundry' | 'images' | 'video_fragments' | 'ai_application' | 'video_master';

interface UIState {
    activeView: ViewType;
    setActiveView: (view: ViewType) => void;

    isAnalyzing: boolean;
    setIsAnalyzing: (isAnalyzing: boolean) => void;

    progress: number;
    setProgress: (progress: number) => void;

    statusMessage: string;
    setStatusMessage: (message: string) => void;

    error: string | null;
    setError: (error: string | null) => void;

    // Simple toast system
    toast: { message: string; type: 'success' | 'error' | 'info' } | null;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    hideToast: () => void;

    batchProgress: BatchProgress | null;
    setBatchProgress: (progress: BatchProgress | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    activeView: 'context',
    setActiveView: (view) => set({ activeView: view }),

    isAnalyzing: false,
    setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

    progress: 0,
    setProgress: (progress) => set({ progress }),

    statusMessage: '',
    setStatusMessage: (message) => set({ statusMessage: message }),

    error: null,
    setError: (error) => set({ error }),

    toast: null,
    showToast: (message, type = 'info') => set({ toast: { message, type } }),
    hideToast: () => set({ toast: null }),

    batchProgress: null,
    setBatchProgress: (batchProgress) => set({ batchProgress }),
}));
