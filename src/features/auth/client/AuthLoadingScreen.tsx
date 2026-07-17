"use client";

export function AuthLoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-6 py-12 text-center text-base text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}

