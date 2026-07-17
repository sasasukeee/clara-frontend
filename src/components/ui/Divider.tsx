type DividerProps = {
  label?: string;
};

export function Divider({ label = "veya" }: DividerProps) {
  return (
    <div className="relative py-6">
      <div aria-hidden="true" className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200 dark:border-white/10" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[var(--background)] px-4 text-sm text-slate-400 dark:text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}
