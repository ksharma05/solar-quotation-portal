import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { FormError } from '@/components/common/FormError'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/fieldset'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { PANELS, panelById } from '@/constants/catalogue'
import { capacityFromPanels, panelCount } from '@/services/pricing/quotationEngine'
import { capacityError, type QuotationFormValues } from '@/services/validation/quotationSchema'
import { formatWatts } from '@/utils/formatters'

/**
 * Panel counts are the source of truth; capacity is derived. The Anil job mixes two
 * panel types to reach 10,280 Wp, so a single "target kW" input cannot express the
 * real configuration. PROJECT_PLAN.md §4.3.
 */
export function PanelConfigForm() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<QuotationFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'panels' })

  const panels = useWatch({ control, name: 'panels' }) ?? []
  const capacityWp = capacityFromPanels(panels)
  const totalPanels = panelCount(panels)
  const rangeError = capacityError(capacityWp)

  const unused = PANELS.filter((panel) => !panels.some((row) => row?.panelId === panel.id))

  return (
    <section>
      <Subheading>Panels</Subheading>
      <Text className="mt-1 text-xs/5">
        Add one row per panel type. Capacity is calculated from the counts.
      </Text>

      <div className="mt-4 space-y-3">
        {fields.map((field, index) => {
          const selected = panelById(panels[index]?.panelId ?? '')
          const rowWattage = selected ? selected.wattage * (panels[index]?.count ?? 0) : 0

          return (
            <div key={field.id} className="flex flex-wrap items-end gap-3">
              <Field className="min-w-56 flex-1">
                {index === 0 && <Label>Panel type</Label>}
                <Select {...register(`panels.${index}.panelId`)}>
                  {PANELS.map((panel) => (
                    <option key={panel.id} value={panel.id}>
                      {panel.name} — {panel.wattage} Wp
                    </option>
                  ))}
                </Select>
              </Field>

              <Field className="w-28">
                {index === 0 && <Label>Count</Label>}
                <Input
                  type="number"
                  min={1}
                  step={1}
                  {...register(`panels.${index}.count`, { valueAsNumber: true })}
                />
              </Field>

              <div className="w-28 pb-2 text-sm/6 tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatWatts(rowWattage)}
              </div>

              <Button
                plain
                aria-label="Remove panel type"
                disabled={fields.length === 1}
                onClick={() => remove(index)}
                className="mb-1"
              >
                <TrashIcon />
              </Button>

              {errors.panels?.[index]?.panelId && (
                <div className="w-full">
                  <FormError>{errors.panels[index]?.panelId?.message}</FormError>
                </div>
              )}
              {errors.panels?.[index]?.count && (
                <div className="w-full">
                  <FormError>{errors.panels[index]?.count?.message}</FormError>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {unused.length > 0 && (
        <Button
          outline
          className="mt-4"
          onClick={() => append({ panelId: unused[0].id, count: 1 })}
        >
          <PlusIcon />
          Add panel type
        </Button>
      )}

      <div className="mt-5 rounded-lg bg-zinc-50 px-4 py-3 ring-1 ring-zinc-950/5 dark:bg-zinc-800/50 dark:ring-white/10">
        <div className="text-sm/6 text-zinc-500 dark:text-zinc-400">System capacity</div>
        <div className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
          {formatWatts(capacityWp)}
        </div>
        <div className="text-xs/5 text-zinc-500 dark:text-zinc-400">
          {totalPanels} panel{totalPanels === 1 ? '' : 's'} · {(capacityWp / 1000).toFixed(2)} kW
        </div>
      </div>

      {rangeError && <FormError className="mt-2">{rangeError}</FormError>}
      {typeof errors.panels?.message === 'string' && (
        <FormError className="mt-2">{errors.panels.message}</FormError>
      )}
    </section>
  )
}
