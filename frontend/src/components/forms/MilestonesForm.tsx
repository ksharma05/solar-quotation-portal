import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { ArrowPathIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { FormError } from '@/components/common/FormError'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/fieldset'
import { Input } from '@/components/ui/input'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { defaultMilestones } from '@/constants/milestones'
import { capacityFromPanels } from '@/services/pricing/quotationEngine'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

const MAX_MILESTONES = 6

export function MilestonesForm() {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<QuotationFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'milestones' })

  const milestones = useWatch({ control, name: 'milestones' }) ?? []
  const panels = useWatch({ control, name: 'panels' }) ?? []
  const capacityKw = capacityFromPanels(panels) / 1000

  const total = milestones.reduce(
    (sum, milestone) => sum + (Number.isFinite(milestone?.percentage) ? milestone.percentage : 0),
    0
  )
  const balanced = Math.abs(total - 100) <= 0.001

  const reseed = (): void => {
    setValue('milestones', defaultMilestones(capacityKw), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <Subheading>Payment milestones</Subheading>
        <Button plain onClick={reseed} className="text-xs">
          <ArrowPathIcon />
          Reset to {capacityKw <= 15 ? '3-stage' : '5-stage'} default
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-wrap items-end gap-3">
            <Field className="w-24">
              {index === 0 && <Label>%</Label>}
              <Input
                type="number"
                step="0.01"
                {...register(`milestones.${index}.percentage`, { valueAsNumber: true })}
              />
            </Field>

            <Field className="min-w-64 flex-1">
              {index === 0 && <Label>Description</Label>}
              <Input
                {...register(`milestones.${index}.description`)}
                placeholder="Advance with Work Order"
              />
            </Field>

            <Button
              plain
              aria-label="Remove milestone"
              disabled={fields.length <= 2}
              onClick={() => remove(index)}
              className="mb-1"
            >
              <TrashIcon />
            </Button>

            {errors.milestones?.[index]?.description && (
              <div className="w-full">
                  <FormError>{errors.milestones[index]?.description?.message}</FormError>
                </div>
            )}
            {errors.milestones?.[index]?.percentage && (
              <div className="w-full">
                  <FormError>{errors.milestones[index]?.percentage?.message}</FormError>
                </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {fields.length < MAX_MILESTONES && (
          <Button outline onClick={() => append({ percentage: 0, description: '' })}>
            <PlusIcon />
            Add milestone
          </Button>
        )}

        <Text
          className={
            balanced
              ? 'text-sm/6 !text-green-700 dark:!text-green-400'
              : 'text-sm/6 !text-red-600 dark:!text-red-400'
          }
        >
          Total {total.toFixed(2)}%{balanced ? '' : ' — must be exactly 100%'}
        </Text>
      </div>

      {typeof errors.milestones?.message === 'string' && (
        <FormError className="mt-2">{errors.milestones.message}</FormError>
      )}
    </section>
  )
}
