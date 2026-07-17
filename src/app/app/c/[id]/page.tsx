"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ActiveConversationPage } from "@/features/app/ActiveConversationPage";
import { AuthLoadingScreen } from "@/features/auth/client/AuthLoadingScreen";
import { useAuthStatus } from "@/stores/auth.store";

export default function ConversationPage(props: any) {
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const router = useRouter();
  const status = useAuthStatus();

  useEffect(() => {
    void Promise.resolve(props.params).then((p) => setConversationId(p?.id));
  }, [props.params]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  return <ActiveConversationPage initialConversationId={conversationId} />;
}
