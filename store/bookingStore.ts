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

export type SelectedService = {
  id: number;
  name: string;
  category: string;
  priceRange: string;
};

type BookingState = {
  phone: string;
  contactMethod: "phone" | "email";
  contactValue: string;
  customerName: string;
  designer: Designer | null;
  serviceIds: number[];
  selectedServices: SelectedService[];
  date: string | null;
  time: string | null;
  setPhone: (phone: string) => void;
  setContact: (method: "phone" | "email", value: string) => void;
  setCustomerName: (name: string) => void;
  setDesigner: (d: Designer) => void;
  toggleService: (id: number, service?: SelectedService) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  reset: () => void;
};

export const useBookingStore = create<BookingState>((set) => ({
  phone: "",
  contactMethod: "phone",
  contactValue: "",
  customerName: "",
  designer: null,
  serviceIds: [],
  selectedServices: [],
  date: null,
  time: null,
  setPhone: (phone) => set({ phone }),
  setContact: (contactMethod, contactValue) => set({ contactMethod, contactValue, phone: contactValue }),
  setCustomerName: (customerName) => set({ customerName }),
  setDesigner: (d) => set({ designer: d }),
  toggleService: (id, service) =>
    set((s) => ({
      serviceIds: s.serviceIds.includes(id)
        ? s.serviceIds.filter((x) => x !== id)
        : [...s.serviceIds, id],
      selectedServices: s.serviceIds.includes(id)
        ? s.selectedServices.filter((item) => item.id !== id)
        : service
          ? [...s.selectedServices, service]
          : s.selectedServices,
    })),
  setDate: (date) => set({ date, time: null }),
  setTime: (time) => set({ time }),
  reset: () => set({ phone: "", contactMethod: "phone", contactValue: "", customerName: "", designer: null, serviceIds: [], selectedServices: [], date: null, time: null }),
}));
