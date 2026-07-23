import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "zh" | "en";

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "zh",
      setLanguage: (language) => set({ language }),
      toggleLanguage: () => set((state) => ({ language: state.language === "zh" ? "en" : "zh" })),
    }),
    { name: "booking-language" }
  )
);
