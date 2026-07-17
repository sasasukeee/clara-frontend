"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  startIcon?: ReactNode;
};

type SelectProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  className?: string;
  size?: "lg" | "sm";
  labelPosition?: "floating" | "above";
  labelClassName?: string;
  menuPlacement?: "auto" | "top" | "bottom";
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className ?? "h-4 w-4"}
  >
    <path
      fillRule="evenodd"
      d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

export function Select({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
  className,
  size = "lg",
  labelPosition = "floating",
  labelClassName,
  menuPlacement = "auto",
}: SelectProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [resolvedPlacement, setResolvedPlacement] = useState<"top" | "bottom">("bottom");
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<
    | {
        left: number;
        width: number;
        top?: number;
        bottom?: number;
        maxHeight: number;
      }
    | null
  >(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
    setMenuStyle(null);
  };

  const openWithIndex = (index: number) => {
    setOpen(true);
    setActiveIndex(index);
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = rect.width;
    const VIEWPORT_MARGIN = 12;
    const GAP = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = rect.left;
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
    );
    if (resolvedPlacement === "top") {
      const bottom = Math.max(0, viewportHeight - rect.top + GAP);
      const maxHeight = Math.max(120, rect.top - VIEWPORT_MARGIN - GAP);
      setMenuStyle({ left, width, bottom, maxHeight });
    } else {
      const top = Math.max(0, rect.bottom + GAP);
      const maxHeight = Math.max(120, viewportHeight - top - VIEWPORT_MARGIN);
      setMenuStyle({ left, width, top, maxHeight });
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const root = buttonRef.current?.closest("[data-select-root]");
      if (!root) return;
      const menu = menuRef.current;
      if (menu?.contains(target)) return;
      if (!root.contains(target)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const focusButton = () => {
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const selectIndex = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
    focusButton();
  };

  const moveActive = (direction: 1 | -1) => {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        const selectedIndex = Math.max(
          0,
          options.findIndex((option) => option.value === value)
        );
        openWithIndex(selectedIndex);
      } else {
        moveActive(1);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        const selectedIndex = Math.max(
          0,
          options.findIndex((option) => option.value === value)
        );
        openWithIndex(selectedIndex);
      } else {
        moveActive(-1);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        const selectedIndex = Math.max(
          0,
          options.findIndex((option) => option.value === value)
        );
        openWithIndex(selectedIndex);
      } else if (activeIndex >= 0) {
        selectIndex(activeIndex);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
    }
  };

  const findScrollableParent = (element: HTMLElement | null) => {
    let node: HTMLElement | null = element?.parentElement ?? null;
    while (node) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const isScrollable = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      if (isScrollable && node.scrollHeight > node.clientHeight + 1) return node;
      node = node.parentElement;
    }
    return null;
  };

  useEffect(() => {
    if (!open) return;
    if (menuPlacement !== "auto") {
      setResolvedPlacement(menuPlacement);
      return;
    }
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const scrollParent = findScrollableParent(button);
    const containerRect = scrollParent?.getBoundingClientRect();
    const bottomBoundary = containerRect?.bottom ?? window.innerHeight;
    const topBoundary = containerRect?.top ?? 0;
    const bottomSpace = Math.max(0, bottomBoundary - rect.bottom);
    const topSpace = Math.max(0, rect.top - topBoundary);
    const menuMaxHeight = 256 + 16;
    const next = bottomSpace < menuMaxHeight && topSpace > bottomSpace ? "top" : "bottom";
    setResolvedPlacement(next);
  }, [open, menuPlacement]);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    if (!button) return;

    const VIEWPORT_MARGIN = 12;
    const GAP = 8;

    const updatePosition = () => {
      const rect = button.getBoundingClientRect();
      const width = rect.width;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = rect.left;
      left = Math.min(Math.max(left, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN));

      if (resolvedPlacement === "top") {
        const bottom = Math.max(0, viewportHeight - rect.top + GAP);
        const maxHeight = Math.max(120, rect.top - VIEWPORT_MARGIN - GAP);
        setMenuStyle({ left, width, bottom, maxHeight });
      } else {
        const top = Math.max(0, rect.bottom + GAP);
        const maxHeight = Math.max(120, viewportHeight - top - VIEWPORT_MARGIN);
        setMenuStyle({ left, width, top, maxHeight });
      }
    };

    updatePosition();

    const scrollParent = findScrollableParent(button);
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { passive: true });
    scrollParent?.addEventListener("scroll", updatePosition, { passive: true });

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
      scrollParent?.removeEventListener("scroll", updatePosition);
    };
  }, [open, resolvedPlacement]);

  const menu = open && menuStyle ? (
    <div
      ref={menuRef}
      data-select-menu
      className={cx(
        "fixed z-[1000] rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-lighter)] p-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
      )}
      style={{
        left: menuStyle.left,
        width: menuStyle.width,
        top: menuStyle.top,
        bottom: menuStyle.bottom,
      }}
    >
      <div
        id={listboxId}
        role="listbox"
        aria-labelledby={id}
        className="app-scrollbar overflow-auto"
        style={{ maxHeight: menuStyle.maxHeight }}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const isActive = index === activeIndex;
          return (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={option.disabled}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectIndex(index)}
              className={cx(
                "cursor-pointer w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all flex items-center justify-between gap-3",
                option.disabled && "cursor-not-allowed opacity-50",
                isActive && !option.disabled && "bg-foreground/5",
                !isActive && !option.disabled && "hover:bg-foreground/5",
                isSelected && "text-[color:var(--foreground)] font-medium"
              )}
            >
              <span className="flex items-center gap-2">
                {option.startIcon && <span className="text-[18px]">{option.startIcon}</span>}
                <span className="text-[color:var(--foreground)]">{option.label}</span>
              </span>
              {isSelected && (
                <span className="text-primary">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div data-select-root className={cx("block space-y-1.5", className)}>
      {labelPosition === "above" && (
        <span className={cx("block text-xs font-semibold text-[color:var(--foreground-muted)]", labelClassName)}>
          {label}
        </span>
      )}
      <div
        className={cx(
          "group relative mx-auto flex w-full items-center overflow-visible border transition-all duration-200 [--label-bg:var(--card)]",
          size === "lg" ? "rounded-[32px] bg-[color:var(--card)] border-[color:var(--border)]" : "rounded-xl border-[color:var(--border)]/50 bg-foreground/5 hover:bg-foreground/10 hover:border-[color:var(--border)]",
          open && "ring-2 ring-primary/20 border-primary/50",
          disabled && "opacity-70"
        )}
      >
        <button
          ref={buttonRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => {
            if (disabled) return;
            if (open) close();
            else {
              const selectedIndex = Math.max(
                0,
                options.findIndex((option) => option.value === value)
              );
              openWithIndex(selectedIndex);
            }
          }}
          onKeyDown={handleButtonKeyDown}
          className={cx(
            "cursor-pointer w-full bg-transparent text-left focus:outline-none disabled:cursor-not-allowed",
            size === "lg"
              ? "h-[62px] rounded-[32px] px-5 pr-12 text-[18px] focus-visible:ring-1 focus-visible:ring-primary/20"
              : "h-11 rounded-xl px-4 pr-10 text-sm focus-visible:ring-2 focus-visible:ring-primary/30",
            "text-[color:var(--foreground)] focus-visible:ring-offset-0 transition-all"
          )}
        >
          <span className="flex items-center gap-2">
            {selected?.startIcon && <span className="text-[18px]">{selected.startIcon}</span>}
            <span className={cx(!selected ? "text-[color:var(--foreground-muted)]" : "")}>
              {selected?.label ?? ""}
            </span>
          </span>
        </button>

        {labelPosition === "floating" && (
          <span
            className={cx(
              "pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-[color:var(--label-bg)] leading-none font-bold transition-all duration-200 z-10",
              size === "lg" ? "pl-4 pr-4.5 text-[13px]" : "px-2 text-[12px]",
              "text-[color:var(--foreground)]"
            )}
          >
            {label}
          </span>
        )}

        <span
          className={cx(
            "pointer-events-none absolute top-1/2 -translate-y-1/2",
            size === "lg" ? "right-5" : "right-3",
            "text-[color:var(--foreground-muted)]"
          )}
        >
          <ChevronDownIcon className={cx("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </div>

      {portalRoot ? createPortal(menu, portalRoot) : menu}
      {hint && <span className="block text-sm text-slate-500 dark:text-slate-400">{hint}</span>}
    </div>
  );
}
