import { AuthTopBar } from "@/features/auth/components/AuthTopBar";
import { AuthLegalLinks } from "@/features/auth/components/AuthLegalLinks";
import { GoogleContinueButton } from "@/features/auth/components/GoogleContinueButton";
import { AuthAccountShortcut } from "@/features/auth/components/AuthAccountShortcut";

import { useTranslation } from "@/lib/i18n/I18nProvider";

import { SignupForm } from "./client/SignupForm";

export function SignupPage() {
  const { t } = useTranslation();

  return (
    <div className="auth-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-foreground">
      <AuthTopBar />
      <main className="relative z-10 flex min-h-screen origin-top scale-90 items-center justify-center px-6 py-12 sm:px-8">
        <div className="w-full max-w-3xl space-y-10 pt-20">
          <header className="space-y-4 text-center">
            <h1 className="text-[38px] font-bold leading-[1.05] tracking-tight text-foreground md:text-[44px]">
              {t.auth.signupTitle}
            </h1>
            <p className="text-lg text-text-secondary">
              {t.auth.signupSubtitle}
            </p>
          </header>

          <SignupForm />

          <div className="mx-auto flex w-full max-w-lg justify-center">
            <GoogleContinueButton />
          </div>

          <AuthAccountShortcut kind="signup" />

          <AuthLegalLinks />
        </div>
      </main>
    </div>
  );
}
