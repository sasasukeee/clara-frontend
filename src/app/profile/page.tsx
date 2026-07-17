"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ProfileOnboardingPage } from "@/features/profile/ProfileOnboardingPage";
import { AuthLoadingScreen } from "@/features/auth/client/AuthLoadingScreen";
import { useAuthStatus } from "@/stores/auth.store";

export default function ProfilePage() {
  const router = useRouter();
  const status = useAuthStatus();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  return <ProfileOnboardingPage />;
}
