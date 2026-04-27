import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  dark: boolean;
  fsIndex: number;
  setDark: (v: boolean) => void;
  setFsIndex: (v: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dark: false,
      fsIndex: 1,
      setDark: (v) => set({ dark: v }),
      setFsIndex: (v) => set({ fsIndex: v }),
    }),
    { name: "bc-settings" }
  )
);

export const fontSizes = [
  { label: "小", value: 0.85 },
  { label: "中", value: 1 },
  { label: "大", value: 1.15 },
];
