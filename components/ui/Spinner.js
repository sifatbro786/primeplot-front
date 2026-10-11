import { cn } from "@/lib/cn";

/** Decorative spinner — pair with text or aria-busy on the container. */
export function Spinner({ className }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn("size-4 animate-spin", className)} fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}
