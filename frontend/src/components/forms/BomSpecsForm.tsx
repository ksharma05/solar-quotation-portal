import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { ArrowPathIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { FormError } from '@/components/common/FormError'
import { Button } from '@/components/ui/button'
import { ErrorMessage, Field, Label } from '@/components/ui/fieldset'
import { Input } from '@/components/ui/input'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { defaultBomRows } from '@/constants/bomDefaults'
import { capacityFromPanels } from '@/services/pricing/quotationEngine'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

/**
 * Specifications only — no prices. The 15 costing lines never appear here.
 * Defaults are capacity-seeded and every field stays editable. PROJECT_PLAN.md §5.2.
 */
export function BomSpecsForm() {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<QuotationFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'bom' })

  const panels = useWatch({ control, name: 'panels' }) ?? []
  const capacityKw = capacityFromPanels(panels) / 1000

  /**
   * Drops the generated rich rendering of a cell once the operator edits its plain text.
   *
   * `detailsRich` / `quantityRich` carry the bold specification figures the reference
   * prints. They are generated from the seeded defaults, so once the plain field is
   * edited they are stale — and the exporters prefer them, which would print the
   * original wording back at the operator.
   */
  const clearRich = (index: number, field: 'detailsRich' | 'quantityRich'): void => {
    setValue(`bom.${index}.${field}`, undefined, { shouldDirty: true })
  }

  const reseed = (): void => {
    setValue('bom', defaultBomRows(capacityKw), { shouldDirty: true, shouldValidate: true })
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <Subheading>Bill of materials</Subheading>
        <Button plain onClick={reseed} className="text-xs">
          <ArrowPathIcon />
          Reseed from {capacityKw <= 15 ? 'small' : 'large'}-system defaults
        </Button>
      </div>

      <Text className="mt-1 text-xs/5">
        Specifications only — this table carries no prices. Panels and inverter rows are added
        automatically from the system configuration.
      </Text>

      <div className="mt-4 space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-lg border border-zinc-950/10 p-4 dark:border-white/10"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <Label>Material</Label>
                <Input {...register(`bom.${index}.material`)} />
                {errors.bom?.[index]?.material && (
                  <ErrorMessage>{errors.bom[index]?.material?.message}</ErrorMessage>
                )}
              </Field>
              <Field>
                <Label>Quantity</Label>
                <Input
                  {...register(`bom.${index}.quantity`, {
                    onChange: () => clearRich(index, 'quantityRich'),
                  })}
                />
              </Field>
              <Field className="sm:col-span-2">
                <Label>Details</Label>
                <Input
                  {...register(`bom.${index}.details`, {
                    onChange: () => clearRich(index, 'detailsRich'),
                  })}
                />
              </Field>
              <Field className="sm:col-span-2">
                <Label>Warranty</Label>
                <Input {...register(`bom.${index}.warranty`)} />
              </Field>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                plain
                aria-label="Remove material"
                disabled={fields.length === 1}
                onClick={() => remove(index)}
                className="text-xs"
              >
                <TrashIcon />
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        outline
        className="mt-4"
        onClick={() => append({ material: '', details: '', quantity: '', warranty: '' })}
      >
        <PlusIcon />
        Add material
      </Button>

      {typeof errors.bom?.message === 'string' && (
        <FormError className="mt-2">{errors.bom.message}</FormError>
      )}
    </section>
  )
}
