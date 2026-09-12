import { COMPANY } from '@/constants/config'
import {
  CLIENT_SCOPE,
  COVER_LETTER,
  PRICE_ROW_DESCRIPTION,
  SCOPE_OF_WORKS,
  SCOPE_OF_WORKS_INTRO,
  SUBSIDY_NOTE,
  TERMS_AND_CONDITIONS,
} from '@/constants/boilerplate'
import { inverterById } from '@/constants/catalogue'
import { computeTotals } from '@/services/pricing/costingEngine'
import {
  capacityFromPanels,
  computeQuotation,
  milestoneAmounts,
  printsSubsidy,
} from '@/services/pricing/quotationEngine'
import { systemBomRows } from '@/services/quotation/documentBom'
import { useCostingStore } from '@/stores/costingStore'
import { useProjectsStore } from '@/stores/projectsStore'
import { formatDocumentDate, validTillIso } from '@/utils/dates'
import { formatINR, formatRate } from '@/utils/formatters'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="border-b border-zinc-950/20 pb-1 text-sm font-bold tracking-wide text-zinc-950 uppercase dark:border-white/20 dark:text-white">
        {title}
      </h3>
      <div className="mt-3 text-sm/6 text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  )
}

/**
 * Mirrors the sample DOCX section-for-section. PROJECT_PLAN.md §5.
 *
 * Note what is absent: the 15 costing lines. The customer sees one priced row and an
 * unpriced specification table.
 */
export function QuotationPreview({ values }: { values: QuotationFormValues }) {
  const lines = useCostingStore((state) => state.lines)
  const ratePerWatt = computeTotals(lines).totalRatePerWatt

  // The projects the operator actually selected, in their chosen order — the preview
  // must agree with what the export prints, not with a fixed list.
  const catalogue = useProjectsStore((state) => state.projects)
  const selectedProjects = (values.referenceProjectIds ?? [])
    .map((id) => catalogue.find((project) => project.id === id))
    .filter((project): project is (typeof catalogue)[number] => project !== undefined)

  const capacityWp = capacityFromPanels(values.panels)
  const capacityKw = capacityWp / 1000
  const totals = computeQuotation({
    capacityWp,
    ratePerWatt,
    subsidyAmount: values.subsidyAmount,
  })

  const inverter = inverterById(values.inverterId)
  const amounts = milestoneAmounts(
    values.milestones.map((milestone) => milestone.percentage),
    totals.finalPayable
  )
  const validTill = validTillIso(values.quotationDate, values.validityDays)
  const bomRows = [...systemBomRows(values.panels, values.inverterId), ...values.bom]
  const showSubsidy = printsSubsidy(values.subsidyAmount)

  return (
    <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-zinc-950 ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10 print:ring-0">
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-zinc-950/80 pb-4 dark:border-white/60">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="size-14 shrink-0 object-contain" />
          <div>
            <div className="text-lg font-bold tracking-tight uppercase">{COMPANY.name}</div>
            <div className="text-xs/5 text-zinc-600 dark:text-zinc-400">{COMPANY.email}</div>
          </div>
        </div>
        <div className="text-right text-xs/5 text-zinc-600 dark:text-zinc-400">
          <div>{COMPANY.address}</div>
          <div>{COMPANY.phone}</div>
          <div>GSTIN: {COMPANY.gstin}</div>
        </div>
      </header>

      {/* Title block */}
      <div className="mt-6 text-center">
        <h2 className="text-base font-bold uppercase">
          EPC Proposal for {capacityKw.toFixed(2)} KW Grid Tied Solar Power Plant
        </h2>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm/6">
        <div className="flex gap-2">
          <dt className="font-semibold">CLIENT:</dt>
          <dd>{values.leadName || '—'}</dd>
        </div>
        <div className="flex justify-end gap-2">
          <dt className="font-semibold">DATE:</dt>
          <dd>{formatDocumentDate(values.quotationDate)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">Location</dt>
          <dd>{values.projectName || '—'}</dd>
        </div>
        <div className="flex justify-end gap-2">
          <dt className="font-semibold">Quotation No.:</dt>
          <dd>{values.quotationNumber}</dd>
        </div>
      </dl>

      {/* Cover letter */}
      <div className="mt-6 space-y-3 text-sm/6">
        <p>Respected Sir,</p>
        {COVER_LETTER.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
        <p>Thanking you.</p>
        <div className="pt-2">
          <p>Warm Regards,</p>
          <p>From {COMPANY.name}</p>
          <p>{COMPANY.address}</p>
          <p className="mt-2 font-semibold">{COMPANY.signatory}</p>
          <p>{COMPANY.phone}</p>
        </div>
      </div>

      {/* Priced row — one line, never the costing breakdown */}
      <Section
        title={`Quotation (${capacityKw.toFixed(2)} KW – Panels with ${inverter?.capacityKw ?? '—'} KW inverter)`}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800">
                {[
                  'S.No.',
                  'DESCRIPTION',
                  'CAPACITY (Watt)',
                  'RATE / WATT',
                  'PRICE (₹) Excl. GST',
                  'PRICE (₹) Incl. GST',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="border border-zinc-950/20 px-2 py-2 text-left font-semibold dark:border-white/20"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-zinc-950/20 px-2 py-2 dark:border-white/20">1</td>
                <td className="border border-zinc-950/20 px-2 py-2 dark:border-white/20">
                  {PRICE_ROW_DESCRIPTION}
                </td>
                <td className="border border-zinc-950/20 px-2 py-2 tabular-nums dark:border-white/20">
                  {capacityWp} Wp
                </td>
                <td className="border border-zinc-950/20 px-2 py-2 tabular-nums dark:border-white/20">
                  {formatRate(ratePerWatt)}/WATT
                </td>
                <td className="border border-zinc-950/20 px-2 py-2 tabular-nums dark:border-white/20">
                  {formatINR(totals.priceExclGst)}
                </td>
                <td className="border border-zinc-950/20 px-2 py-2 tabular-nums dark:border-white/20">
                  {formatINR(totals.priceInclGst)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Subsidy — suppressed entirely at zero */}
      {showSubsidy && (
        <div className="mt-4 space-y-1 text-sm/6 font-medium">
          {SUBSIDY_NOTE(formatINR(totals.subsidy), formatINR(totals.finalPayable)).map((note) => (
            <p key={note.slice(0, 24)}>{note}</p>
          ))}
        </div>
      )}

      <Section title="Terms & Conditions">
        <ul className="list-disc space-y-1 pl-5">
          {TERMS_AND_CONDITIONS.map((term) => (
            <li key={term.slice(0, 24)}>{term}</li>
          ))}
          {validTill && (
            <li>
              Above given quotation is valid till {values.validityDays} days i.e.{' '}
              {formatDocumentDate(validTill)}
            </li>
          )}
        </ul>
      </Section>

      <Section title="Terms of Payment">
        <ul className="space-y-1">
          {values.milestones.map((milestone, index) => (
            <li key={index} className="flex justify-between gap-4">
              <span>
                {milestone.percentage}% {milestone.description}
              </span>
              <span className="shrink-0 tabular-nums">{formatINR(amounts[index] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Bill of Materials">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800">
                {['Material', 'Details', 'Quantity', 'Warranty'].map((heading) => (
                  <th
                    key={heading}
                    className="border border-zinc-950/20 px-2 py-2 text-left font-semibold dark:border-white/20"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bomRows.map((row, index) => (
                <tr key={`${row.material}-${index}`}>
                  <td className="border border-zinc-950/20 px-2 py-2 align-top font-medium dark:border-white/20">
                    {row.material}
                  </td>
                  <td className="border border-zinc-950/20 px-2 py-2 align-top dark:border-white/20">
                    {row.details}
                  </td>
                  <td className="border border-zinc-950/20 px-2 py-2 align-top dark:border-white/20">
                    {row.quantity}
                  </td>
                  <td className="border border-zinc-950/20 px-2 py-2 align-top dark:border-white/20">
                    {row.warranty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Scope of Works">
        <p>{SCOPE_OF_WORKS_INTRO}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {SCOPE_OF_WORKS.map((item) => (
            <li key={item.slice(0, 24)}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title="Client Scope">
        <ul className="space-y-2">
          {CLIENT_SCOPE.map((clause) => (
            <li key={clause.title}>
              <span className="font-semibold">{clause.title}:</span> {clause.body}
            </li>
          ))}
        </ul>
      </Section>

      {selectedProjects.length > 0 && (
        <Section title="Some of Our Projects:">
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {selectedProjects.map((project) => (
              <li key={project.id}>
                <span className="font-medium">{project.name}</span>
                {project.capacity && <> — {project.capacity}</>}
                {project.imageCount > 0 ? (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {' '}
                    ({project.imageCount} photo{project.imageCount === 1 ? '' : 's'})
                  </span>
                ) : (
                  // Named, not merely dimmed: this project will be absent from the
                  // document, and the operator should learn that here rather than from
                  // the finished PDF.
                  <span className="text-amber-600 dark:text-amber-500">
                    {' '}
                    — no photographs, will not be printed
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

    </article>
  )
}
