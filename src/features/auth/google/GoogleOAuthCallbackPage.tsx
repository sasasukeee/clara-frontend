"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getUserMessageForAppError, toAppError } from "@/lib/errors/AppError";

import { completeGoogleOAuth } from "../api";

const getParam = (url: URL, key: string) => {
  const fromQuery = url.searchParams.get(key);
  if (fromQuery) return fromQuery;
  const hash = url.hash?.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!hash) return null;
  return new URLSearchParams(hash).get(key);
};

type Props = {
  callbackPath: string;
};

export function GoogleOAuthCallbackPage({ callbackPath }: Props) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setErrorMessage(null);
      setIsLoading(true);
      try {
        const url = new URL(window.location.href);
        const originalSearch = url.search;
        const providerError = getParam(url, "error");
        const providerErrorDescription = getParam(url, "error_description");
        const idToken = getParam(url, "id_token")?.trim();
        const code = getParam(url, "code")?.trim();
        const state = getParam(url, "state")?.trim() || undefined;

        window.history.replaceState({}, document.title, callbackPath);

        if (providerError) {
          const message = providerErrorDescription
            ? `${providerError}: ${providerErrorDescription}`
            : providerError;
          setErrorMessage(message);
          return;
        }

        if (idToken) {
          await completeGoogleOAuth({ idToken });
          router.replace("/auth/success");
          return;
        }

        if (code) {
          try {
            await completeGoogleOAuth({ code, state });
            router.replace("/auth/success");
            return;
          } catch (error) {
            const appError = toAppError(error);
            if (appError.status === 404 || appError.status === 405) {
              window.location.assign(
                `/api/gateway/auth/oauth/google/callback${originalSearch || ""}`
              );
              return;
            }
            throw error;
          }
        }

        setErrorMessage("Failed to retrieve Google login information. Please try again.");
      } catch (error) {
        setErrorMessage(getUserMessageForAppError(toAppError(error)));
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [callbackPath, router]);

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-12 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-lg pt-20 text-center">
        <h1 className="text-2xl font-black tracking-tight">Sign in with Google</h1>

        {isLoading ? (
          <p className="mt-4 text-base text-slate-500 dark:text-slate-400">
            Verifying your Google account...
          </p>
        ) : errorMessage ? (
          <>
            <p className="mt-4 text-base text-red-600 dark:text-red-400">{errorMessage}</p>
            <div className="mt-6 flex justify-center gap-4 text-sm text-text-secondary">
              <Link
                href="/login"
                className="font-semibold text-primary no-underline underline-offset-4 decoration-transparent transition-colors hover:underline hover:text-primary-hover focus-visible:underline focus-visible:outline-none"
              >
                Back to login
              </Link>
              <span className="text-text-secondary/40">|</span>
              <Link
                href="/signup"
                className="font-semibold text-primary no-underline underline-offset-4 decoration-transparent transition-colors hover:underline hover:text-primary-hover focus-visible:underline focus-visible:outline-none"
              >
                Sign up
              </Link>
            </div>
          </>
        ) : (
          <p className="mt-4 text-base text-slate-500 dark:text-slate-400">
            Redirecting...
          </p>
        )}
      </div>
    </div>
  );
}
