import { create } from "zustand";
import type { SourceLocation } from "@/types/extraction";

interface ExtractionStore {
  activeHighlights: SourceLocation[];
  activeField: string | null;
  selectedTab: string;
  setActiveHighlights: (highlights: SourceLocation[], field: string) => void;
  clearHighlights: () => void;
  setSelectedTab: (tab: string) => void;
}

export const useExtractionStore = create<ExtractionStore>((set) => ({
  activeHighlights: [],
  activeField: null,
  selectedTab: "extraction",
  setActiveHighlights: (highlights, field) =>
    set({ activeHighlights: highlights, activeField: field }),
  clearHighlights: () => set({ activeHighlights: [], activeField: null }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
}));
