import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { InverterForm } from '@/components/forms/InverterForm'
import { LeadInfoForm } from '@/components/forms/LeadInfoForm'
import { MilestonesForm } from '@/components/forms/MilestonesForm'
import { PanelConfigForm } from '@/components/forms/PanelConfigForm'
import { SubsidyForm } from '@/components/forms/SubsidyForm'
import { BomSpecsForm } from '@/components/forms/BomSpecsForm'
import { defaultBomRows } from '@/constants/bomDefaults'
import { defaultMilestones } from '@/constants/milestones'
import { suggestQuotationNumber } from '@/utils/dates'
import { computeTotals } from '@/services/pricing/costingEngine'
import {
  capacityFromPanels,
  computeQuotation,
  milestoneAmounts,
} from '@/services/pricing/quotationEngine'
import { quotationSchema, type QuotationFormValues } from '@/services/validation/quotationSchema'
import { useCostingStore } from '@/stores/costingStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatINR, formatRate, formatWatts } from '@/utils/formatters'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Live figures, so the effect of the costing sheet is visible while filling the form. */
function LivePricing({ ratePerWatt }: { ratePerWatt: number }) {
  const panels = useWatch<QuotationFormValues, 'panels'>({ name: 'panels' }) ?? []
  const subsidyAmount =
    useWatch<QuotationFormValues, 'subsidyAmount'>({ name: 'subsidyAmount' }) ?? 0
  const milestones = useWatch<QuotationFormValues, 'milestones'>({ name: 'milestones' }) ?? []

  const capacityWp = capacityFromPanels(panels)
  const totals = computeQuotation({ capacityWp, ratePerWatt, subsidyAmount })
  const amounts = milestoneAmounts(
    milestones.map((milestone) => milestone?.percentage ?? 0),
    totals.finalPayable
  )

  return (
    <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800/50">
      <Subheading>Pricing</Subheading>
      <Text className="mt-1 text-xs/5">
        Rate from the costing sheet: {formatRate(ratePerWatt, 6)}/W, prints as{' '}
        {formatRate(ratePerWatt)}.
      </Text>

      <dl className="mt-4 space-y-2 text-sm/6">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">Capacity</dt>
          <dd className="tabular-nums">{formatWatts(capacityWp)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">Price (excl. GST)</dt>
          <dd className="tabular-nums">{formatINR(totals.priceExclGst)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">Price (incl. GST)</dt>
          <dd className="tabular-nums">{formatINR(totals.priceInclGst)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">Less subsidy</dt>
          <dd className="tabular-nums">−{formatINR(totals.subsidy)}</dd>
        </div>
        <Divider className="!my-3" soft />
        <div className="flex justify-between gap-4 font-semibold">
          <dt>Final payable</dt>
          <dd className="tabular-nums">{formatINR(totals.finalPayable)}</dd>
        </div>
      </dl>

      {amounts.length > 0 && (
        <>
          <Divider className="my-4" soft />
          <Text className="text-xs/5 font-medium">Milestones</Text>
          <ol className="mt-2 space-y-1 text-xs/5">
            {amounts.map((amount, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span className="truncate text-zinc-500 dark:text-zinc-400">
                  {milestones[index]?.percentage ?? 0}% ·{' '}
                  {milestones[index]?.description || 'Untitled'}
                </span>
                <span className="shrink-0 tabular-nums">{formatINR(amount)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

export function QuotationForm({
  onPreview,
  initialValues,
}: {
  onPreview: (values: QuotationFormValues) => void
  initialValues?: QuotationFormValues
}) {
  const lines = useCostingStore((state) => state.lines)
  const ratePerWatt = computeTotals(lines).totalRatePerWatt
  const subsidyDefault = useSettingsStore((state) => state.subsidyDefault)
  const validityDaysDefault = useSettingsStore((state) => state.validityDaysDefault)

  const methods = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    mode: 'onBlur',
    defaultValues: initialValues ?? {
      leadName: '',
      projectName: '',
      email: '',
      phone: '',
      quotationNumber: suggestQuotationNumber(today()),
      quotationDate: today(),
      validityDays: validityDaysDefault,
      panels: [{ panelId: 'waaree-dcr-590', count: 17 }],
      inverterId: 'sungrow-10',
      subsidyAmount: subsidyDefault,
      milestones: defaultMilestones(10),
      bom: defaultBomRows(10),
    },
  })

  const onSubmit = (values: QuotationFormValues): void => {
    onPreview(values)
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="space-y-8">
            <LeadInfoForm />
            <Divider />
            <PanelConfigForm />
            <Divider />
            <InverterForm />
            <Divider />
            <SubsidyForm />
            <Divider />
            <MilestonesForm />
            <Divider />
            <BomSpecsForm />
          </div>

          <div className="space-y-4 lg:sticky lg:top-6">
            <LivePricing ratePerWatt={ratePerWatt} />
            <Button type="submit" className="w-full">
              Continue to preview
            </Button>
            {!methods.formState.isValid && methods.formState.isSubmitted && (
              <Text className="text-xs/5 !text-red-600 dark:!text-red-400">
                Some fields need attention.
              </Text>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
