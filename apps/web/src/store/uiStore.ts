import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  backlogView: 'table' | 'board';
  setBacklogView: (view: 'table' | 'board') => void;
  fullWidth: boolean;
  setFullWidth: (fullWidth: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  backlogView: 'table',
  setBacklogView: (view) => set({ backlogView: view }),
  fullWidth: false,
  setFullWidth: (fullWidth) => set({ fullWidth }),
}));
