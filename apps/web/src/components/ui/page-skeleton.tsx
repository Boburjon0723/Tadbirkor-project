export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="h-10 w-48 rounded-xl bg-white/5" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-[2rem] bg-white/[0.03] border border-white/5" />
        ))}
      </div>
      <div className="h-72 rounded-[2rem] bg-white/[0.03] border border-white/5" />
      {rows > 0 && (
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/[0.03] border border-white/5" />
          ))}
        </div>
      )}
    </div>
  );
}
