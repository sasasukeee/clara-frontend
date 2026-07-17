"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStatus } from "@/stores/auth.store";

import { AuthLoadingScreen } from "@/features/auth/client/AuthLoadingScreen";

import { LoginPage } from "../LoginPage";

export function LoginRoute() {
  const router = useRouter();
  const status = useAuthStatus();

  useEffect(() => {
    if (status === "authenticated") router.replace("/app");
  }, [router, status]);

  if (status === "authenticated") return <AuthLoadingScreen />;
  return <LoginPage />;
}

