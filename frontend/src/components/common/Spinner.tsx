import clsx from 'clsx'

/** Not part of Catalyst, so defined here. PROJECT_PLAN.md §6.4. */
export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={clsx(className, 'inline-flex')}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="size-5 animate-spin text-zinc-400 dark:text-zinc-500"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

/** Centred fallback for a whole page while its chunk loads. */
export function PageSpinner() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3">
      <Spinner />
      <span className="text-sm/6 text-zinc-500 dark:text-zinc-400">Loading…</span>
    </div>
  )
}
