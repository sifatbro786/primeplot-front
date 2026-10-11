import SystemStatus from "@/components/dev/SystemStatus";

// Temporary Phase 0 page — replaced by the public home page in F2.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-subtle">Phase 0 · Foundation</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">PrimePlot</h1>
      <p className="mt-2 text-ink-muted" lang="bn">
        রিয়েল এস্টেট শোকেস, CRM ও বিক্রয় ব্যবস্থাপনা — ৳ ১,২৫,৫০,০০০
      </p>

      <section className="mt-12">
        <h2 className="mb-3 text-sm font-medium text-ink-muted">System check</h2>
        <SystemStatus />
      </section>

      <ul className="mt-12 grid grid-cols-5 gap-2 font-mono text-[11px] text-ink-muted">
        {/* Full class names — Tailwind can't see dynamically built ones like `bg-status-${s}`. */}
        {[
          ["available", "bg-status-available"],
          ["held", "bg-status-held"],
          ["booked", "bg-status-booked"],
          ["sold", "bg-status-sold"],
          ["blocked", "bg-status-blocked"],
        ].map(([label, cls]) => (
          <li key={label} className="flex flex-col gap-1">
            <span className={`h-6 rounded-sm ${cls}`} />
            {label}
          </li>
        ))}
      </ul>
    </main>
  );
}
