import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  chatOverlayOpen: boolean;
  setChatOverlayOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  backlogView: 'table',
  setBacklogView: (view) => set({ backlogView: view }),
  fullWidth: false,
  setFullWidth: (fullWidth) => set({ fullWidth }),
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  chatOverlayOpen: false,
  setChatOverlayOpen: (open) => set({ chatOverlayOpen: open }),
    }),
    {
      name: 'pulsetrack-ui',
      // persist only sidebar collapse across reloads
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
