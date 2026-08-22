import { NumericInput } from '@/components/common/NumericInput'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatINR } from '@/utils/formatters'
import type { CostingLine, CostingLineDef } from '@/types'

/**
 * One costing line. Both ₹/W and ₹ are editable; typing in either derives the other
 * and flips the line's entry mode. The derived field renders dimmed.
 */
export function CostingRow({
  def,
  line,
  onPrice,
  onRate,
}: {
  def: CostingLineDef
  line: CostingLine
  onPrice: (price: number) => void
  onRate: (rate: number) => void
}) {
  const rateDriven = line.entryMode === 'rate'
  const withGst = line.price * (1 + def.gstRate / 100)

  return (
    <TableRow>
      <TableCell className="text-zinc-500 tabular-nums dark:text-zinc-400">{def.sno}</TableCell>

      <TableCell className="max-w-xs">
        <div className="flex items-center gap-2">
          <span className="truncate" title={def.description}>
            {def.description}
          </span>
          {def.margin && (
            <Badge color="amber" className="shrink-0">
              margin
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="w-40">
        <NumericInput
          aria-label={`${def.description} — rate per watt`}
          value={line.rate}
          decimals={6}
          muted={!rateDriven}
          onCommit={onRate}
        />
      </TableCell>

      <TableCell className="w-44">
        <NumericInput
          aria-label={`${def.description} — price`}
          value={line.price}
          decimals={2}
          muted={rateDriven}
          onCommit={onPrice}
        />
      </TableCell>

      <TableCell className="text-zinc-500 tabular-nums dark:text-zinc-400">
        {def.gstRate}%
      </TableCell>

      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
        {formatINR(withGst)}
      </TableCell>
    </TableRow>
  )
}
