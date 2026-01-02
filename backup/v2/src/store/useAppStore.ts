import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EnvConfig {
  name: string;
  apiBase: string;
  token: string;
  tenantId: string;
  isConnected: boolean;
}

interface AppState {
  source: EnvConfig;
  target: EnvConfig;
  setSource: (config: Partial<EnvConfig>) => void;
  setTarget: (config: Partial<EnvConfig>) => void;
  setSourceConnected: (status: boolean) => void;
  setTargetConnected: (status: boolean) => void;
  reset: () => void;
}

const defaultEnv: EnvConfig = {
  name: '',
  apiBase: '', // Default empty
  token: '',
  tenantId: '1',
  isConnected: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      source: { ...defaultEnv, name: '来源环境 (Source)' },
      target: { ...defaultEnv, name: '目标环境 (Target)' },

      setSource: (config) =>
        set((state) => ({
          source: { ...state.source, ...config },
        })),

      setTarget: (config) =>
        set((state) => ({
          target: { ...state.target, ...config },
        })),
        
      setSourceConnected: (status) =>
        set((state) => ({
          source: { ...state.source, isConnected: status },
        })),

      setTargetConnected: (status) =>
        set((state) => ({
          target: { ...state.target, isConnected: status },
        })),

      reset: () =>
        set({
          source: { ...defaultEnv, name: '来源环境 (Source)' },
          target: { ...defaultEnv, name: '目标环境 (Target)' },
        }),
    }),
    {
      name: 'menu-sync-storage',
    }
  )
);
