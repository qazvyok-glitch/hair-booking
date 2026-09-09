export const appRoutes = {
  customer: {
    home: "/",
    bookingStart: "/booking/step/1",
    bookingStep2: "/booking/step/2",
    bookingStep3: "/booking/step/3",
    bookingStep4: "/booking/step/4",
    bookingSuccess: "/booking/success",
    myBookings: "/booking/my-bookings",
  },
  designer: {
    home: "/designer/preview-v2",
    login: "/designer/login",
  },
  admin: {
    home: "/admin/dashboard",
    login: "/admin/login",
    bookings: "/admin/bookings",
  },
} as const;
