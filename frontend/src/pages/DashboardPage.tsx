import { CurrencyRupeeIcon, DocumentTextIcon } from '@heroicons/react/16/solid'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { COMPANY } from '@/constants/config'
import { isConfigured } from '@/services/api/client'
import { computeTotals } from '@/services/pricing/costingEngine'
import { useCostingStore } from '@/stores/costingStore'
import { formatINR, formatRate } from '@/utils/formatters'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-950/10 p-5 dark:border-white/10">
      <div className="text-sm/6 text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs/5 text-zinc-500 dark:text-zinc-400">{hint}</div>}
    </div>
  )
}

export function DashboardPage() {
  const lines = useCostingStore((state) => state.lines)
  const capacityW = useCostingStore((state) => state.capacityW)
  const title = useCostingStore((state) => state.title)
  const totals = computeTotals(lines)

  return (
    <div className="mx-auto max-w-5xl">
      <Heading>{COMPANY.name}</Heading>
      <Text className="mt-2">Quotation portal — costing sheet and customer quotations.</Text>
      <Divider className="my-6" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Current rate"
          value={`${formatRate(totals.totalRatePerWatt)}/W`}
          hint={`${formatRate(totals.totalRatePerWatt, 6)} stored`}
        />
        <Stat
          label="Sheet capacity"
          value={`${(capacityW / 1000).toFixed(2)} kW`}
          hint={title || 'Untitled costing'}
        />
        <Stat label="Cost excl. GST" value={formatINR(totals.totalCostExclGst)} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/quotation">
          <DocumentTextIcon />
          New quotation
        </Button>
        <Button outline href="/costing">
          <CurrencyRupeeIcon />
          Edit costing sheet
        </Button>
      </div>

      <Divider className="my-8" />

      <section>
        <Subheading>How this works</Subheading>
        <ol className="mt-3 space-y-2 text-sm/6 text-zinc-700 dark:text-zinc-300">
          <li>
            <strong>1. Costing sheet</strong> — enter the actual rupee cost of each of the 15
            lines. The rate per watt is derived. Internal only.
          </li>
          <li>
            <strong>2. Quotation</strong> — panel configuration, inverter, subsidy and payment
            milestones. Pricing uses the derived rate.
          </li>
          <li>
            <strong>3. Share</strong> — generate the PDF, email it, or send a WhatsApp link. The
            costing breakdown never appears on the customer document.
          </li>
        </ol>
      </section>

      {!isConfigured() && (
        <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-950/20">
          <Text className="text-sm/6">
            <strong>Local mode.</strong> No backend configured, so quotations cannot be saved,
            emailed, or turned into PDFs. Costing and preview work normally. See{' '}
            <code>backend/README.md</code>.
          </Text>
        </div>
      )}
    </div>
  )
}
