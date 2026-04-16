import { Logo } from "@/components/shared/Logo";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16">
      <div className="relative">
        <Logo variant="mark" href="" />
        <span
          className="brand-gradient absolute inset-0 rounded-[10px] opacity-40 blur-xl animate-pulse"
          aria-hidden="true"
        />
      </div>
      <p className="mt-6 text-sm font-medium text-ink-500">Loading…</p>
      <div className="mt-4 flex gap-1.5" aria-hidden="true">
        <span className="brand-gradient size-2 rounded-full animate-[pulse_1.4s_ease-in-out_infinite]" />
        <span
          className="brand-gradient size-2 rounded-full animate-[pulse_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="brand-gradient size-2 rounded-full animate-[pulse_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </div>
  );
}
