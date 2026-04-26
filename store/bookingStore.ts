import { create } from "zustand";

type Designer = {
  id: number;
  name: string;
  nickname: string;
  initials: string;
  style: string;
  ig: string;
  bg_color: string;
  text_color: string;
  work_hours: string[];
};

type BookingState = {
  designer: Designer | null;
  serviceIds: number[];
  date: string | null;
  time: string | null;
  setDesigner: (d: Designer) => void;
  toggleService: (id: number) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  reset: () => void;
};

export const useBookingStore = create<BookingState>((set) => ({
  designer: null,
  serviceIds: [],
  date: null,
  time: null,
  setDesigner: (d) => set({ designer: d }),
  toggleService: (id) =>
    set((s) => ({
      serviceIds: s.serviceIds.includes(id)
        ? s.serviceIds.filter((x) => x !== id)
        : [...s.serviceIds, id],
    })),
  setDate: (date) => set({ date, time: null }),
  setTime: (time) => set({ time }),
  reset: () => set({ designer: null, serviceIds: [], date: null, time: null }),
}));