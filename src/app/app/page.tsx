"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ActiveConversationPage } from "@/features/app/ActiveConversationPage";
import { AuthLoadingScreen } from "@/features/auth/client/AuthLoadingScreen";
import { useAuthStatus } from "@/stores/auth.store";

export default function Page() {
  const router = useRouter();
  const status = useAuthStatus();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  return <ActiveConversationPage />;
}
