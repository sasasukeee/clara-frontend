import type { PropsWithChildren } from "react";

type CenteredCardProps = PropsWithChildren<{
  className?: string;
  maxWidth?: string;
}>;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function CenteredCard({
  children,
  className,
  maxWidth = "max-w-xl",
}: CenteredCardProps) {
  return (
    <div className={cx("w-full", maxWidth)}>
      <div
        className={cx(
          "rounded-[28px] bg-surface-lighter/80 p-8 shadow-[0_4px_32px_-10px_rgba(0,0,0,0.12)] backdrop-blur-xl border border-border-color",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
