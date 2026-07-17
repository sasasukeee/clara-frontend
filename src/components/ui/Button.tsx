"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-md hover:bg-primary-hover active:translate-y-[1px] focus-visible:outline-primary",
  outline:
    "border border-border-color text-foreground hover:bg-surface-active focus-visible:outline-primary",
  ghost:
    "text-foreground hover:bg-surface-active focus-visible:outline-primary",
};

export function Button({
  variant = "primary",
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-[1.05rem] font-semibold transition-all duration-200",
        "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        fullWidth && "w-full",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {leftIcon && <span className="flex items-center">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="flex items-center">{rightIcon}</span>}
    </button>
  );
}
