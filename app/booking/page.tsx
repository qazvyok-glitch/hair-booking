"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "../../lib/appRoutes";

export default function BookingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(appRoutes.customer.home);
  }, [router]);

  return null;
}
