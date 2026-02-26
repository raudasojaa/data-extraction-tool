import { create } from "zustand";
import type { SourceLocation } from "@/types/extraction";

interface ExtractionStore {
  activeHighlights: SourceLocation[];
  activeField: string | null;
  selectedTab: string;
  scrollToPage: number | null;
  scrollToField: string | null;
  setActiveHighlights: (highlights: SourceLocation[], field: string) => void;
  clearHighlights: () => void;
  setSelectedTab: (tab: string) => void;
  setScrollToPage: (page: number | null) => void;
  setScrollToField: (field: string | null) => void;
}

export const useExtractionStore = create<ExtractionStore>((set) => ({
  activeHighlights: [],
  activeField: null,
  selectedTab: "extraction",
  scrollToPage: null,
  scrollToField: null,
  setActiveHighlights: (highlights, field) =>
    set({ activeHighlights: highlights, activeField: field }),
  clearHighlights: () => set({ activeHighlights: [], activeField: null }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setScrollToPage: (page) => set({ scrollToPage: page }),
  setScrollToField: (field) => set({ scrollToField: field }),
}));
