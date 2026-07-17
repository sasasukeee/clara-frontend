import Link from "next/link";

type Props = {
  className?: string;
  termsHref?: string;
  privacyHref?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function AuthLegalLinks({
  className,
  termsHref = "/terms",
  privacyHref = "/privacy",
}: Props) {
  const linkClassName =
    "font-medium no-underline underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-none";

  return (
    <div
      className={cx(
        "mt-3 flex justify-center gap-4 text-sm text-text-secondary",
        className
      )}
    >
      <Link href={termsHref} className={linkClassName}>
        Terms of service
      </Link>
      <span className="text-text-secondary/40 dark:text-white/40">|</span>
      <Link href={privacyHref} className={linkClassName}>
        Privacy policy
      </Link>
    </div>
  );
}
