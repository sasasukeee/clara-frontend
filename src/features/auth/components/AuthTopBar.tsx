import Link from "next/link";

type Props = {
  brandHref?: string;
  helpHref?: string;
};

export function AuthTopBar({ brandHref = "/", helpHref = "/yardim" }: Props) {
  const linkClassName =
    "rounded-full px-2 py-1 no-underline underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-none";

  return (
    <div className="absolute top-6 left-6 right-6 z-20 sm:left-8 sm:right-8">
      <div className="flex items-center justify-between text-base">
        <Link
          href={brandHref}
          className={`${linkClassName} text-xl font-semibold tracking-[0.08em]`}
        >
          Clara AI
        </Link>
        <Link
          href={helpHref}
          className={`${linkClassName} text-lg font-semibold`}
        >
          Yardım
        </Link>
      </div>
    </div>
  );
}
