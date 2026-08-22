import { Diagnostics } from '@/components/common/Diagnostics'
import { NumericInput } from '@/components/common/NumericInput'
import { Button } from '@/components/ui/button'
import { DescriptionDetails, DescriptionList, DescriptionTerm } from '@/components/ui/description-list'
import { Divider } from '@/components/ui/divider'
import { Field, Label } from '@/components/ui/fieldset'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { COMPANY, GST_MULTIPLIER } from '@/constants/config'
import { REFERENCE_CAPACITY_W } from '@/constants/costingLines'
import { computeTotals } from '@/services/pricing/costingEngine'
import { useCostingStore } from '@/stores/costingStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatINR, formatRate } from '@/utils/formatters'

export function SettingsPage() {
  const subsidyDefault = useSettingsStore((state) => state.subsidyDefault)
  const validityDaysDefault = useSettingsStore((state) => state.validityDaysDefault)
  const setSubsidyDefault = useSettingsStore((state) => state.setSubsidyDefault)
  const setValidityDaysDefault = useSettingsStore((state) => state.setValidityDaysDefault)
  const resetSettings = useSettingsStore((state) => state.reset)

  const lines = useCostingStore((state) => state.lines)
  const capacityW = useCostingStore((state) => state.capacityW)
  const resetCosting = useCostingStore((state) => state.resetToReference)
  const totals = computeTotals(lines)

  return (
    <div className="mx-auto max-w-3xl">
      <Heading>Settings</Heading>
      <Text className="mt-2">Defaults for new quotations, and the current costing rate.</Text>
      <Divider className="my-6" />

      <section>
        <Subheading>Quotation defaults</Subheading>
        <Text className="mt-1 text-xs/5">
          These pre-fill a new quotation. Both remain editable per quote.
        </Text>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field className="w-56">
            <Label>Subsidy amount (₹)</Label>
            <NumericInput value={subsidyDefault} decimals={2} onCommit={setSubsidyDefault} />
          </Field>

          <Field className="w-40">
            <Label>Validity (days)</Label>
            <NumericInput
              value={validityDaysDefault}
              decimals={0}
              onCommit={setValidityDaysDefault}
            />
          </Field>

          <Button outline className="mb-1" onClick={resetSettings}>
            Reset defaults
          </Button>
        </div>
      </section>

      <Divider className="my-8" />

      <section>
        <Subheading>Current costing rate</Subheading>
        <Text className="mt-1 text-xs/5">
          Derived on the costing sheet. This is the only figure that reaches a customer
          quotation.
        </Text>

        <DescriptionList className="mt-4">
          <DescriptionTerm>Rate per watt</DescriptionTerm>
          <DescriptionDetails>
            {formatRate(totals.totalRatePerWatt, 6)} — prints as{' '}
            {formatRate(totals.totalRatePerWatt)}
          </DescriptionDetails>

          <DescriptionTerm>Sheet capacity</DescriptionTerm>
          <DescriptionDetails>{capacityW.toLocaleString('en-IN')} W</DescriptionDetails>

          <DescriptionTerm>Total cost (excl. GST)</DescriptionTerm>
          <DescriptionDetails>{formatINR(totals.totalCostExclGst)}</DescriptionDetails>
        </DescriptionList>

        <Button outline className="mt-4" onClick={resetCosting}>
          Reset costing sheet to the {REFERENCE_CAPACITY_W.toLocaleString('en-IN')} W reference
        </Button>
      </section>

      <Divider className="my-8" />

      <Diagnostics />

      <Divider className="my-8" />

      <section>
        <Subheading>Company</Subheading>
        <Text className="mt-1 text-xs/5">
          Printed on every quotation letterhead. Edit in{' '}
          <code>src/constants/config.ts</code> and{' '}
          <code>backend/google-apps-script/DocumentModel.gs</code> — both must match.
        </Text>

        <DescriptionList className="mt-4">
          <DescriptionTerm>Name</DescriptionTerm>
          <DescriptionDetails>{COMPANY.name}</DescriptionDetails>
          <DescriptionTerm>Address</DescriptionTerm>
          <DescriptionDetails>{COMPANY.address}</DescriptionDetails>
          <DescriptionTerm>Phone</DescriptionTerm>
          <DescriptionDetails>{COMPANY.phone}</DescriptionDetails>
          <DescriptionTerm>Email</DescriptionTerm>
          <DescriptionDetails>{COMPANY.email}</DescriptionDetails>
          <DescriptionTerm>GSTIN</DescriptionTerm>
          <DescriptionDetails>{COMPANY.gstin}</DescriptionDetails>
          <DescriptionTerm>Signatory</DescriptionTerm>
          <DescriptionDetails>{COMPANY.signatory}</DescriptionDetails>
          <DescriptionTerm>GST multiplier</DescriptionTerm>
          <DescriptionDetails>
            {GST_MULTIPLIER} (70% supply @ 5%, 30% installation @ 18%)
          </DescriptionDetails>
        </DescriptionList>
      </section>
    </div>
  )
}
