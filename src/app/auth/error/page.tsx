import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-12 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-lg pt-20 text-center">
        <h1 className="text-2xl font-black tracking-tight">Login failed</h1>
        <p className="mt-4 text-base text-slate-500 dark:text-slate-400">
          Google login could not be completed. Please try again.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <Link
            href="/login"
            className="font-medium text-slate-600 no-underline underline-offset-4 decoration-transparent transition-colors hover:!underline hover:!text-[#111] hover:!decoration-[#111]"
          >
            Return to login page
          </Link>
        </div>
      </div>
    </div>
  );
}

