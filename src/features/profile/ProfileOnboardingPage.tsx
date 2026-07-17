"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CenteredCard } from "@/components/layout/CenteredCard";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { getUserMessageForAppError, toAppError } from "@/lib/errors/AppError";

import { useTranslation } from "@/lib/i18n/I18nProvider";

import { getIdentityMe, getUserProfile, updateUserProfile } from "./api";

type BirthdateParts = {
  day: string;
  month: string;
  year: string;
};

type GenderValue = "" | "female" | "male" | "other" | "prefer_not_to_say";

export function ProfileOnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const MONTHS = useMemo(() => [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ], []);

  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "done">("form");
  const [birthdateParts, setBirthdateParts] = useState<BirthdateParts>({
    day: "",
    month: "",
    year: "",
  });
  const [hasExistingBirthdate, setHasExistingBirthdate] = useState(false);
  const [gender, setGender] = useState<GenderValue>("");
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setIsBooting(true);
      setErrorMessage(null);
      try {
        const me = await getIdentityMe();
        setUserId(me.userId);

        try {
          const profile = await getUserProfile(me.userId);
          const existingBirthdate = profile.birthdate;
          if (typeof existingBirthdate === "string" && existingBirthdate.trim().length > 0) {
            const parsed = new Date(existingBirthdate);
            if (!Number.isNaN(parsed.getTime())) {
              setBirthdateParts({
                day: String(parsed.getUTCDate()),
                month: String(parsed.getUTCMonth() + 1),
                year: String(parsed.getUTCFullYear()),
              });
            }
            setHasExistingBirthdate(true);
            router.replace("/app");
            return;
          }

          const existingGender = profile.gender;
          if (typeof existingGender === "string" && existingGender.trim().length > 0) {
            const normalized = existingGender.trim() as GenderValue;
            if (
              normalized === "female" ||
              normalized === "male" ||
              normalized === "other" ||
              normalized === "prefer_not_to_say"
            ) {
              setGender(normalized);
            }
          }
        } catch {
          setHasExistingBirthdate(false);
        }
      } catch (error) {
        setErrorMessage(getUserMessageForAppError(toAppError(error)));
      } finally {
        setIsBooting(false);
      }
    };
    void run();
  }, [router]);

  useEffect(() => {
    if (isBooting) return;
    if (!userId) return;
    if (step !== "done") return;

    const timer = window.setTimeout(() => {
      router.replace("/app");
    }, 600);

    return () => window.clearTimeout(timer);
  }, [isBooting, router, step, userId]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const values: number[] = [];
    for (let year = currentYear; year >= 1900; year -= 1) values.push(year);
    return values;
  }, []);

  const daysInSelectedMonth = useMemo(() => {
    const year = Number(birthdateParts.year);
    const month = Number(birthdateParts.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || year <= 0 || month <= 0) return 31;
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }, [birthdateParts.month, birthdateParts.year]);

  const birthdateValue = useMemo(() => {
    const year = Number(birthdateParts.year);
    const month = Number(birthdateParts.month);
    const day = Number(birthdateParts.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (year <= 0 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }, [birthdateParts.day, birthdateParts.month, birthdateParts.year]);

  const birthdateIso = useMemo(() => {
    if (!birthdateValue) return null;
    return `${birthdateValue}T00:00:00.000Z`;
  }, [birthdateValue]);

  const birthdatePretty = useMemo(() => {
    const year = Number(birthdateParts.year);
    const month = Number(birthdateParts.month);
    const day = Number(birthdateParts.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (!birthdateValue) return null;
    const monthLabel = MONTHS.find((entry) => entry.value === month)?.label;
    if (!monthLabel) return null;
    return `${day} ${monthLabel} ${year}`;
  }, [birthdateParts.day, birthdateParts.month, birthdateParts.year, birthdateValue]);

  const birthdateError = useMemo(() => {
    if (!birthdateParts.year || !birthdateParts.month || !birthdateParts.day) {
      return "Birthdate is required.";
    }
    if (!birthdateValue) return "Select a valid date.";
    return null;
  }, [birthdateParts.day, birthdateParts.month, birthdateParts.year, birthdateValue]);

  const setBirthdatePart = (field: keyof BirthdateParts, value: string) => {
    setBirthdateParts((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "month" || field === "year") {
        const day = Number(next.day);
        const year = Number(next.year);
        const month = Number(next.month);
        const maxDay =
          Number.isFinite(day) &&
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          year > 0 &&
          month > 0
            ? new Date(Date.UTC(year, month, 0)).getUTCDate()
            : 31;
        if (Number.isFinite(day) && day > maxDay) next.day = "";
      }
      return next;
    });
  };

  const saveProfile = async (mode: "save" | "skip") => {
    if (!userId) return;
    const needsBirthdateWrite = !hasExistingBirthdate;

    if (needsBirthdateWrite && !birthdateIso) {
      setErrorMessage("Birthdate is required.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (!needsBirthdateWrite && mode === "skip") {
        setStep("done");
        router.refresh();
        return;
      }

      await updateUserProfile(userId, {
        birthdate: needsBirthdateWrite ? birthdateIso : undefined,
        gender: mode === "save" ? gender || undefined : undefined,
      });
      setStep("done");
      router.refresh();
    } catch (error) {
      setErrorMessage(getUserMessageForAppError(toAppError(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-theme min-h-screen bg-[var(--background)] px-6 py-12 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 pt-20">
        {step === "form" && (
          <header className="w-full max-w-xl space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight mb-2">{t.profile.completeProfile}</h1>
            <p className="text-sm text-text-secondary">
              {t.profile.introduceYourself}
            </p>
          </header>
        )}

        {step === "done" && (
          <header className="w-full max-w-xl space-y-2 text-center">
            <h1 className="text-3xl font-black tracking-tight">Done!</h1>
            <p className="text-sm text-text-secondary">Your information has been saved.</p>
          </header>
        )}

        <CenteredCard maxWidth="max-w-xl" className="w-full">
          {errorMessage && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              {errorMessage}
            </div>
          )}

          {isBooting ? (
            <div className="text-sm text-text-secondary">{t.profile.booting}</div>
          ) : !userId ? (
            <div className="text-sm text-text-secondary">
              {t.profile.failedToLoadUser}
            </div>
          ) : step === "form" ? (
            <div className="space-y-5">
              {!hasExistingBirthdate ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Select
                      label="Day"
                      value={birthdateParts.day}
                      onChange={(next) => setBirthdatePart("day", next)}
                      options={[
                        { value: "", label: "Select" },
                        ...Array.from({ length: daysInSelectedMonth }, (_, index) => ({
                          value: String(index + 1),
                          label: String(index + 1),
                        })),
                      ]}
                    />
                    <Select
                      label="Month"
                      value={birthdateParts.month}
                      onChange={(next) => setBirthdatePart("month", next)}
                      options={[
                        { value: "", label: "Select" },
                        ...MONTHS.map((month) => ({
                          value: String(month.value),
                          label: month.label,
                        })),
                      ]}
                    />
                    <Select
                      label="Year"
                      value={birthdateParts.year}
                      onChange={(next) => setBirthdatePart("year", next)}
                      options={[
                        { value: "", label: "Select" },
                        ...years.map((year) => ({
                          value: String(year),
                          label: String(year),
                        })),
                      ]}
                    />
                  </div>

                  {birthdateError && (
                    <div className="text-sm text-text-secondary">
                      {birthdateError}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-border-color bg-surface-dark/50 p-4 text-sm text-text-secondary shadow-sm backdrop-blur">
                  {t.profile.alreadySaved}
                </div>
              )}

              {(birthdatePretty || birthdateValue) && (
                <div className="rounded-2xl border border-border-color bg-surface-dark/50 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-surface-lighter text-foreground">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M8 2v4" />
                          <path d="M16 2v4" />
                          <path d="M3 10h18" />
                          <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                        </svg>
                      </span>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                          {t.profile.selectedBirthdate}
                        </div>
                        <div className="text-base font-semibold text-foreground">
                          {birthdatePretty ?? birthdateValue}
                        </div>
                      </div>
                    </div>
                    {hasExistingBirthdate && (
                      <span className="rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {t.profile.allDone}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <label className="block text-sm font-medium mb-1.5">{t.profile.genderLabel}</label>
              <Select
                value={gender}
                onChange={(next) => setGender(next as GenderValue)}
                options={[
                  { value: "", label: "Select gender" },
                  { value: "female", label: t.profile.genderFemale },
                  { value: "male", label: t.profile.genderMale },
                  { value: "other", label: t.profile.genderOther },
                  { value: "prefer_not_to_say", label: t.profile.genderPreferNotToSay },
                ]}
              />

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-2 text-sm"
                  disabled={isSubmitting || !hasExistingBirthdate}
                  onClick={() => saveProfile("skip")}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting || (!hasExistingBirthdate && Boolean(birthdateError))}
                  onClick={() => saveProfile("save")}
                >
                  {isSubmitting ? t.common.saving : t.common.save}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">{t.profile.allDone}</h2>
              <p className="text-sm text-text-secondary mb-6">
                {t.profile.infoSaved}
                <br />
                {t.profile.updateLater}
              </p>
            </div>
          )}
        </CenteredCard>
      </div>
    </div>
  );
}
