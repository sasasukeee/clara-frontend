"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onEndIconClick?: () => void;
  endIconAriaLabel?: string;
  iconOrder?: "start-end" | "end-start";
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      startIcon,
      endIcon,
      onEndIconClick,
      endIconAriaLabel,
      iconOrder = "start-end",
      className,
      type = "text",
      ...props
    },
    ref
  ) => {
    const id = useId();

    const hasRightIcons = Boolean(startIcon || endIcon);
    const inputPadding = cx(
      "h-[62px] w-full rounded-[32px] bg-transparent text-[18px] text-foreground placeholder:text-transparent focus:outline-none",
      hasRightIcons ? "pl-5 pr-20" : "px-5"
    );

    return (
      <label className="block space-y-1.5">
        <div
          className={cx(
            "group relative mx-auto flex max-w-lg items-center overflow-visible rounded-[32px] border-[3px] border-foreground/40 bg-[color:var(--background)] transition-all duration-200 [--label-bg:var(--background)] hover:border-foreground/60 focus-within:border-foreground/80 shadow-sm",
            className
          )}
        >
          <div className="relative flex-1">
            <input
              id={id}
              ref={ref}
              type={type}
              placeholder=" "
              className={`peer ${inputPadding}`}
              {...props}
            />
            <span
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 bg-[color:var(--label-bg)] pl-4 pr-4.5 leading-none text-[15px] font-semibold text-text-secondary transition-all duration-200 z-10
              peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[17px]
              peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[13px] peer-focus:font-bold peer-focus:text-foreground
              peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:-translate-y-1/2 peer-[&:not(:placeholder-shown)]:text-[13px]`}
            >
              {label}
            </span>
          </div>

          {(startIcon || endIcon) && (
            <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-3 text-[22px] text-foreground">
              {iconOrder === "start-end" ? (
                <>
                  {startIcon && (
                    <span className="pointer-events-none">{startIcon}</span>
                  )}
                  {endIcon &&
                    (onEndIconClick ? (
                      <button
                        type="button"
                        onClick={onEndIconClick}
                        className="cursor-pointer text-inherit transition-colors hover:text-foreground focus-visible:outline-none"
                        tabIndex={-1}
                        aria-label={endIconAriaLabel ?? "toggle input action"}
                      >
                        {endIcon}
                      </button>
                    ) : (
                      <span className="pointer-events-none">{endIcon}</span>
                    ))}
                </>
              ) : (
                <>
                  {endIcon &&
                    (onEndIconClick ? (
                      <button
                        type="button"
                        onClick={onEndIconClick}
                        className="cursor-pointer text-inherit transition-colors hover:text-foreground focus-visible:outline-none"
                        tabIndex={-1}
                        aria-label={endIconAriaLabel ?? "toggle input action"}
                      >
                        {endIcon}
                      </button>
                    ) : (
                      <span className="pointer-events-none">{endIcon}</span>
                    ))}
                  {startIcon && (
                    <span className="pointer-events-none">{startIcon}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {hint && (
          <span className="block text-sm text-text-secondary">{hint}</span>
        )}
      </label>
    );
  }
);

Input.displayName = "Input";
