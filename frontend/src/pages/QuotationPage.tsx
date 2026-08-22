import { useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/16/solid'
import { QuotationForm } from '@/components/forms/QuotationForm'
import { QuotationPreview } from '@/components/quotation/QuotationPreview'
import { ShareOptions } from '@/components/quotation/ShareOptions'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

export function QuotationPage() {
  const [draft, setDraft] = useState<QuotationFormValues | null>(null)

  if (draft) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Heading>Preview</Heading>
            <Text className="mt-2">
              This is the customer document. PDF generation and delivery arrive on Day 6.
            </Text>
          </div>
          <Button outline onClick={() => setDraft(null)}>
            <ArrowLeftIcon />
            Back to edit
          </Button>
        </div>
        <Divider className="my-6" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <QuotationPreview values={draft} />
          <div className="lg:sticky lg:top-6">
            <ShareOptions values={draft} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Heading>New Quotation</Heading>
      <Text className="mt-2">
        Client details, panel configuration, inverter, subsidy and payment milestones. Pricing uses
        the rate derived on the costing sheet.
      </Text>
      <Divider className="my-6" />
      <QuotationForm onPreview={setDraft} />
    </div>
  )
}
