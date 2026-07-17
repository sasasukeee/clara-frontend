"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getUserMessageForAppError, toAppError } from "@/lib/errors/AppError";

import { useTranslation } from "@/lib/i18n/I18nProvider";

import { login, type LoginPayload } from "../../api";

type IconProps = { className?: string };

const iconClass = (className?: string) =>
  className ? className : "h-[26px] w-[26px]";

const MailIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={iconClass(className)}
  >
    <path d="M4.75 6h14.5c.414 0 .75.336.75.75v10.5c0 .414-.336.75-.75.75H4.75a.75.75 0 0 1-.75-.75V6.75C4 6.336 4.336 6 4.75 6Z" />
    <path d="m5.5 7 6.5 5 6.5-5" />
  </svg>
);

const UserIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={iconClass(className)}
  >
    <circle cx="12" cy="9" r="3.5" />
    <path d="M6 18.75a6 6 0 0 1 12 0" />
  </svg>
);

const EyeIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={iconClass(className)}
  >
    <path d="M2.5 12c1.3-4.2 5.2-7 9.5-7s8.2 2.8 9.5 7c-1.3 4.2-5.2 7-9.5 7s-8.2-2.8-9.5-7Z" />
    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeOffIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={iconClass(className)}
  >
    <path d="M9.25 9.25A3 3 0 0 0 15 12" />
    <path d="M10.5 5.2A10.6 10.6 0 0 1 12 5c4.3 0 8.2 2.8 9.5 7-.43 1.37-1.2 2.6-2.2 3.6" />
    <path d="M6.7 6.7A10.1 10.1 0 0 0 2.5 12c1.3 4.2 5.2 7 9.5 7 1.75 0 3.4-.47 4.85-1.3" />
    <path d="M3.5 3.5l17 17" />
  </svg>
);

const CheckIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={iconClass(className)}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ArrowRightIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={iconClass(className)}
  >
    <path d="M4.5 12h14" />
    <path d="m14.75 6.75 4.75 5.25-4.75 5.25" />
  </svg>
);

export function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState<LoginPayload>({
    identifier: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(form);
      router.push("/auth/success");
    } catch (error) {
      setErrorMessage(getUserMessageForAppError(toAppError(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange =
    (field: keyof LoginPayload) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const trimmedIdentifier = form.identifier.trim();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(trimmedIdentifier);
  const isValidUsername =
    /^(?=\S+$)(?=(?:.*\p{L}){2,})[\p{L}\p{N}_]+$/u.test(trimmedIdentifier);
  const isEmailActive = trimmedIdentifier.length > 0 && isValidEmail;
  const isUsernameActive = trimmedIdentifier.length > 0 && isValidUsername;
  const activeIconClassName = "text-emerald-600 dark:text-emerald-400";
  const isPasswordValid = form.password.length >= 7 && /\d/.test(form.password);

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <Input
        label="E-posta veya kullanıcı adı"
        value={form.identifier}
        onChange={handleChange("identifier")}
        required
        startIcon={
          <MailIcon
            className={`h-[26px] w-[26px] ${isEmailActive ? activeIconClassName : ""}`}
          />
        }
        endIcon={
          <UserIcon
            className={`h-[27px] w-[27px] ${isUsernameActive ? activeIconClassName : ""}`}
          />
        }
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      <Input
        label="Parola"
        type={showPassword ? "text" : "password"}
        value={form.password}
        onChange={handleChange("password")}
        required
        autoComplete="current-password"
        iconOrder="end-start"
        startIcon={
          <CheckIcon
            className={`h-[24px] w-[24px] ${isPasswordValid ? activeIconClassName : ""}`}
          />
        }
        endIcon={
          showPassword ? (
            <EyeIcon className="h-[26px] w-[26px]" />
          ) : (
            <EyeOffIcon className="h-[26px] w-[26px]" />
          )
        }
        endIconAriaLabel={showPassword ? "Parolayı gizle" : "Parolayı göster"}
        onEndIconClick={() => setShowPassword((prev) => !prev)}
      />

      {errorMessage && (
        <p className="mx-auto w-full max-w-lg text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        fullWidth
        disabled={isSubmitting}
        rightIcon={
          <ArrowRightIcon className="h-[20px] w-[20px] transition-transform group-hover:translate-x-1" />
        }
        className="auth-cta group mx-auto mt-2 h-[70px] max-w-lg rounded-[32px] px-10 text-[18px] font-normal border border-border-color shadow-sm transition-colors active:bg-slate-200 focus-visible:outline-black"
      >
        {isSubmitting ? "Gönderiliyor..." : "Devam et"}
      </Button>
    </form>
  );
}
