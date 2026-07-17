"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getIdentityMe, getUserProfile } from "@/features/profile/api";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const me = await getIdentityMe();
        const profile = await getUserProfile(me.userId);
        const hasBirthdate =
          typeof profile.birthdate === "string" && profile.birthdate.trim().length > 0;
        router.replace(hasBirthdate ? "/app" : "/profile");
      } catch {
        router.replace("/profile");
      }
    };
    void run();
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-foreground">
      <h1 className="sr-only">Başarılı</h1>
    </div>
  );
}
