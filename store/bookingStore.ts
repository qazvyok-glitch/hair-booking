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
  duration?: string;
};

type BookingState = {
  phone: string;
  contactMethod: "phone" | "email";
  contactValue: string;
  customerName: string;
  attendeeCount: 1 | 2;
  companionName: string;
  companionServiceIds: number[];
  companionSelectedServices: SelectedService[];
  designer: Designer | null;
  serviceIds: number[];
  selectedServices: SelectedService[];
  date: string | null;
  time: string | null;
  setPhone: (phone: string) => void;
  setContact: (method: "phone" | "email", value: string) => void;
  setCustomerName: (name: string) => void;
  setAttendeeCount: (count: 1 | 2) => void;
  setCompanionName: (name: string) => void;
  setDesigner: (d: Designer) => void;
  toggleService: (id: number, service?: SelectedService) => void;
  toggleCompanionService: (id: number, service?: SelectedService) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  reset: () => void;
};

export const useBookingStore = create<BookingState>((set) => ({
  phone: "",
  contactMethod: "phone",
  contactValue: "",
  customerName: "",
  attendeeCount: 1,
  companionName: "",
  companionServiceIds: [],
  companionSelectedServices: [],
  designer: null,
  serviceIds: [],
  selectedServices: [],
  date: null,
  time: null,
  setPhone: (phone) => set({ phone }),
  setContact: (contactMethod, contactValue) => set({ contactMethod, contactValue, phone: contactValue }),
  setCustomerName: (customerName) => set({ customerName }),
  setAttendeeCount: (attendeeCount) =>
    set((state) => ({
      attendeeCount,
      companionName: attendeeCount === 1 ? "" : state.companionName,
      companionServiceIds: attendeeCount === 1 ? [] : state.companionServiceIds,
      companionSelectedServices: attendeeCount === 1 ? [] : state.companionSelectedServices,
    })),
  setCompanionName: (companionName) => set({ companionName }),
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
  toggleCompanionService: (id, service) =>
    set((s) => ({
      companionServiceIds: s.companionServiceIds.includes(id)
        ? s.companionServiceIds.filter((x) => x !== id)
        : [...s.companionServiceIds, id],
      companionSelectedServices: s.companionServiceIds.includes(id)
        ? s.companionSelectedServices.filter((item) => item.id !== id)
        : service
          ? [...s.companionSelectedServices, service]
          : s.companionSelectedServices,
    })),
  setDate: (date) => set({ date, time: null }),
  setTime: (time) => set({ time }),
  reset: () => set({
    phone: "",
    contactMethod: "phone",
    contactValue: "",
    customerName: "",
    attendeeCount: 1,
    companionName: "",
    companionServiceIds: [],
    companionSelectedServices: [],
    designer: null,
    serviceIds: [],
    selectedServices: [],
    date: null,
    time: null,
  }),
}));
