import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { parseNumeric } from '@/utils/formatters'

/**
 * A numeric field that stays editable while typing.
 *
 * Holds the raw string locally so intermediate states ("2.", "", "0.00") survive,
 * and only reformats from `value` once focus leaves. Without this, a controlled
 * numeric input fights the user on every keystroke.
 */
export function NumericInput({
  value,
  onCommit,
  decimals,
  muted = false,
  ...props
}: {
  value: number
  onCommit: (value: number) => void
  /** Digits shown when the field is not focused. */
  decimals: number
  /** Renders dimmed, to mark this field as derived rather than typed. */
  muted?: boolean
} & Omit<React.ComponentPropsWithoutRef<typeof Input>, 'value' | 'onChange' | 'type'>) {
  const [draft, setDraft] = useState(() => value.toFixed(decimals))
  const focused = useRef(false)

  // Reformat from upstream only while the user is elsewhere.
  useEffect(() => {
    if (!focused.current) setDraft(value.toFixed(decimals))
  }, [value, decimals])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={draft}
      className={muted ? 'opacity-60' : undefined}
      onFocus={(event) => {
        focused.current = true
        event.target.select()
      }}
      onBlur={() => {
        focused.current = false
        setDraft(value.toFixed(decimals))
      }}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        const parsed = parseNumeric(next)
        if (parsed !== null) onCommit(parsed)
      }}
    />
  )
}
