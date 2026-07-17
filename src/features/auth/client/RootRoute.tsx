"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStatus } from "@/stores/auth.store";

import { AuthLoadingScreen } from "./AuthLoadingScreen";

export function RootRoute() {
  const router = useRouter();
  const status = useAuthStatus();

  useEffect(() => {
    if (status === "authenticated") router.replace("/app");
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  return null;
}

