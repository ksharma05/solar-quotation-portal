import { NumericInput } from '@/components/common/NumericInput'
import { CostingRow } from '@/components/costing/CostingRow'
import { CostingSummary } from '@/components/costing/CostingSummary'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/fieldset'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { COSTING_LINES } from '@/constants/costingLines'
import { computeTotals } from '@/services/pricing/costingEngine'
import { useCostingStore } from '@/stores/costingStore'
import { formatINR, formatRate } from '@/utils/formatters'

export function CostingSheet() {
  const title = useCostingStore((state) => state.title)
  const capacityW = useCostingStore((state) => state.capacityW)
  const lines = useCostingStore((state) => state.lines)
  const setTitle = useCostingStore((state) => state.setTitle)
  const setCapacity = useCostingStore((state) => state.setCapacity)
  const updatePrice = useCostingStore((state) => state.updatePrice)
  const updateRate = useCostingStore((state) => state.updateRate)
  const resetToReference = useCostingStore((state) => state.resetToReference)

  const totals = computeTotals(lines)
  const byId = new Map(lines.map((line) => [line.id, line]))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <Field>
          <Label>Job</Label>
          <Input
            value={title}
            placeholder="125 KW with 100 KW inverter — Waaree Mittal Hospital"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field>
          <Label>Capacity (W)</Label>
          <NumericInput value={capacityW} decimals={0} onCommit={setCapacity} className="sm:w-40" />
        </Field>

        <Button outline onClick={resetToReference} className="sm:w-fit">
          Reset to reference
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Table dense grid className="[--gutter:--spacing(4)]">
          <TableHead>
            <TableRow>
              <TableHeader className="w-10">#</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Rate (₹/W)</TableHeader>
              <TableHeader>Price (₹)</TableHeader>
              <TableHeader>GST</TableHeader>
              <TableHeader className="text-right">Incl. line GST</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {COSTING_LINES.map((def) => {
              const line = byId.get(def.id)
              if (!line) return null
              return (
                <CostingRow
                  key={def.id}
                  def={def}
                  line={line}
                  onPrice={(price) => updatePrice(def.id, price)}
                  onRate={(rate) => updateRate(def.id, rate)}
                />
              )
            })}
            <TableRow className="font-semibold">
              <TableCell />
              <TableCell>Total</TableCell>
              <TableCell className="tabular-nums">
                {formatRate(totals.totalRatePerWatt, 6)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatINR(totals.totalCostExclGst)}
              </TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">
                {formatINR(totals.totalWithLineGst)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <CostingSummary totals={totals} />
      </div>
    </div>
  )
}
