import { GST_MULTIPLIER } from '@/constants/config'
import { Divider } from '@/components/ui/divider'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { formatINR, formatRate } from '@/utils/formatters'
import type { CostingTotals } from '@/types'

function Line({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string
  value: string
  hint?: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <div
          className={
            emphasis
              ? 'text-sm/6 font-semibold text-zinc-950 dark:text-white'
              : 'text-sm/6 text-zinc-500 dark:text-zinc-400'
          }
        >
          {label}
        </div>
        {hint && <div className="text-xs/5 text-zinc-500 dark:text-zinc-400">{hint}</div>}
      </div>
      <div
        className={
          emphasis
            ? 'shrink-0 text-base/6 font-semibold tabular-nums text-zinc-950 dark:text-white'
            : 'shrink-0 text-sm/6 tabular-nums text-zinc-950 dark:text-white'
        }
      >
        {value}
      </div>
    </div>
  )
}

export function CostingSummary({ totals }: { totals: CostingTotals }) {
  return (
    <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800/50">
      <Subheading>Derived rate</Subheading>
      <Text className="mt-1 text-xs/5">
        The total ₹/W is the only figure that reaches the customer quotation.
      </Text>

      <div className="mt-3 rounded-lg bg-white px-4 py-3 ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <div className="text-3xl font-semibold tabular-nums text-zinc-950 dark:text-white">
          {formatRate(totals.totalRatePerWatt, 6)}
          <span className="ml-1 text-base font-normal text-zinc-500 dark:text-zinc-400">/W</span>
        </div>
        <div className="mt-0.5 text-xs/5 text-zinc-500 dark:text-zinc-400">
          prints as {formatRate(totals.totalRatePerWatt)} on the quotation
        </div>
      </div>

      <Divider className="my-4" />

      <Line label="Total cost (excl. GST)" value={formatINR(totals.totalCostExclGst)} />
      <Line
        label="Payable"
        hint={`excl. GST × ${GST_MULTIPLIER} (blended 8.9%)`}
        value={formatINR(totals.payable)}
        emphasis
      />

      <Divider className="my-4" soft />

      <Text className="text-xs/5 font-medium">Internal reference only</Text>
      <Line label="GST @ 5% (panel, inverter)" value={formatINR(totals.gstByClass[5])} />
      <Line label="GST @ 18% (balance)" value={formatINR(totals.gstByClass[18])} />
      <Line label="Total with per-line GST" value={formatINR(totals.totalWithLineGst)} />
      <Text className="mt-2 text-xs/5">
        Per-line GST works out to{' '}
        {((totals.totalLineGst / totals.totalCostExclGst) * 100 || 0).toFixed(2)}%, not the 8.9%
        blended rate used for the payable. Do not use it on customer documents.
      </Text>
    </div>
  )
}
