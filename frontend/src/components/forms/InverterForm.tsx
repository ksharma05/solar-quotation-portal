import { useFormContext, useWatch } from 'react-hook-form'
import { Field, Label } from '@/components/ui/fieldset'
import { Select } from '@/components/ui/select'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { INVERTERS, inverterById } from '@/constants/catalogue'
import {
  capacityFromPanels,
  inverterRatio,
  inverterRatioWarning,
} from '@/services/pricing/quotationEngine'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

export function InverterForm() {
  const { control, register } = useFormContext<QuotationFormValues>()

  const panels = useWatch({ control, name: 'panels' }) ?? []
  const inverterId = useWatch({ control, name: 'inverterId' })

  const capacityWp = capacityFromPanels(panels)
  const inverter = inverterById(inverterId ?? '')
  const ratio = inverter ? inverterRatio(inverter.capacityKw, capacityWp) : null
  const warning = inverterRatioWarning(ratio)

  return (
    <section>
      <Subheading>Inverter</Subheading>
      <Field className="mt-4 max-w-md">
        <Label>Inverter</Label>
        <Select {...register('inverterId')}>
          {INVERTERS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} — {option.capacityKw} kW {option.phase}
            </option>
          ))}
        </Select>
      </Field>

      {ratio !== null && (
        <Text className="mt-2 text-xs/5">
          {(ratio * 100).toFixed(1)}% of panel capacity.
          {warning ? ` ${warning}` : ' Within the usual range.'}
        </Text>
      )}
    </section>
  )
}
