import clsx from 'clsx'

/**
 * Section-level validation message.
 *
 * Catalyst's <ErrorMessage> wraps Headless UI's <Description>, which throws
 * "You used a <Description /> component, but it is not inside a relevant parent"
 * unless it sits inside a <Field>. Errors that belong to a whole section — a field
 * array, or a derived value like capacity — have no Field to live in, so they use
 * this instead. Styling matches Catalyst's ErrorMessage.
 */
export function FormError({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p
      data-slot="error"
      className={clsx(
        className,
        'text-base/6 text-red-600 sm:text-sm/6 dark:text-red-500'
      )}
    >
      {children}
    </p>
  )
}
