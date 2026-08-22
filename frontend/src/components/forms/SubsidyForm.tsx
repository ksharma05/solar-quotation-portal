import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { FormError } from '@/components/common/FormError'
import { NumericInput } from '@/components/common/NumericInput'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { DEFAULT_SUBSIDY_AMOUNT } from '@/constants/config'
import { computeTotals } from '@/services/pricing/costingEngine'
import {
  capacityFromPanels,
  computeQuotation,
  subsidyError,
} from '@/services/pricing/quotationEngine'
import { useCostingStore } from '@/stores/costingStore'
import { formatINRWhole } from '@/utils/formatters'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

/**
 * The subsidy line prints on every quotation. The amount is pre-filled with the
 * standard ₹78,000 and edited per quote — set it to 0 for jobs that do not qualify.
 * PROJECT_PLAN.md §4.2.
 */
export function SubsidyForm() {
  const { control, setValue } = useFormContext<QuotationFormValues>()

  const lines = useCostingStore((state) => state.lines)
  const ratePerWatt = computeTotals(lines).totalRatePerWatt

  const panels = useWatch({ control, name: 'panels' }) ?? []
  const subsidyAmount = useWatch({ control, name: 'subsidyAmount' }) ?? 0

  const { priceInclGst } = computeQuotation({
    capacityWp: capacityFromPanels(panels),
    ratePerWatt,
    subsidyAmount: 0,
  })
  const error = subsidyError(subsidyAmount, priceInclGst)

  return (
    <section>
      <Subheading>Subsidy</Subheading>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field className="w-56">
          <Label>Subsidy amount (₹)</Label>
          <Controller
            control={control}
            name="subsidyAmount"
            render={({ field }) => (
              <NumericInput
                value={field.value ?? 0}
                decimals={2}
                onCommit={field.onChange}
                aria-label="Subsidy amount"
              />
            )}
          />
        </Field>

        <Button
          plain
          className="mb-1 text-xs"
          onClick={() =>
            setValue('subsidyAmount', DEFAULT_SUBSIDY_AMOUNT, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          Reset to {formatINRWhole(DEFAULT_SUBSIDY_AMOUNT)}
        </Button>

        <Button
          plain
          className="mb-1 text-xs"
          onClick={() => setValue('subsidyAmount', 0, { shouldDirty: true, shouldValidate: true })}
        >
          Set to zero
        </Button>
      </div>

      {error && <FormError className="mt-2">{error}</FormError>}

      <Text className="mt-2 text-xs/5">
        Shown on every quotation and deducted after GST. Commercial and industrial jobs are not
        eligible for the residential subsidy — set it to zero on those.
      </Text>
    </section>
  )
}
