import Link from "next/link";

type Props = {
  kind: "login" | "signup";
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function AuthAccountShortcut({ kind, className }: Props) {
  const href = kind === "login" ? "/signup" : "/login";
  const prefix = kind === "login" ? "Don't have an account?" : "Already have an account?";
  const label = kind === "login" ? "Sign up" : "Log in";

  const linkClassName =
    "font-semibold text-primary no-underline underline-offset-4 decoration-transparent transition-colors hover:underline hover:text-primary-hover focus-visible:underline focus-visible:outline-none active:underline";

  return (
    <p
      className={cx(
        "mx-auto w-full max-w-lg text-center text-sm text-text-secondary",
        className
      )}
    >
      {prefix}{" "}
      <Link href={href} className={linkClassName}>
        {label}
      </Link>
    </p>
  );
}
