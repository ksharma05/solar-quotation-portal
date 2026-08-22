import clsx from 'clsx'

/** Not part of Catalyst, so defined here. PROJECT_PLAN.md §6.4. */
export function Card({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'rounded-xl border border-zinc-950/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900'
      )}
    >
      {children}
    </div>
  )
}
