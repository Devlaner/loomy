import { create } from "zustand";

export type BoardViewMode = "grid" | "list";
export type BoardSortBy = "lastModified" | "name" | "created";
export type BoardFilterBy = "all" | "owned";

interface DashboardState {
  selectedWorkspaceId: string | null;
  showCreateWorkspace: boolean;
  showCreateBoard: boolean;
  newWorkspaceName: string;
  newBoardName: string;
  searchQuery: string;
  viewMode: BoardViewMode;
  sortBy: BoardSortBy;
  filterBy: BoardFilterBy;
  setSelectedWorkspaceId: (id: string | null) => void;
  setShowCreateWorkspace: (show: boolean) => void;
  setShowCreateBoard: (show: boolean) => void;
  setNewWorkspaceName: (name: string) => void;
  setNewBoardName: (name: string) => void;
  setSearchQuery: (q: string) => void;
  setViewMode: (m: BoardViewMode) => void;
  setSortBy: (s: BoardSortBy) => void;
  setFilterBy: (f: BoardFilterBy) => void;
  resetCreateForms: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedWorkspaceId: null,
  showCreateWorkspace: false,
  showCreateBoard: false,
  newWorkspaceName: "",
  newBoardName: "",
  searchQuery: "",
  viewMode: "list",
  sortBy: "lastModified",
  filterBy: "all",
  setSelectedWorkspaceId: (id) => set({ selectedWorkspaceId: id }),
  setShowCreateWorkspace: (show) => set({ showCreateWorkspace: show }),
  setShowCreateBoard: (show) => set({ showCreateBoard: show }),
  setNewWorkspaceName: (name) => set({ newWorkspaceName: name }),
  setNewBoardName: (name) => set({ newBoardName: name }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setViewMode: (m) => set({ viewMode: m }),
  setSortBy: (s) => set({ sortBy: s }),
  setFilterBy: (f) => set({ filterBy: f }),
  resetCreateForms: () => set({ newWorkspaceName: "", newBoardName: "" }),
}));
