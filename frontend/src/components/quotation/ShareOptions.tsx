import { useState } from 'react'
import {
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  EnvelopeIcon,
} from '@heroicons/react/16/solid'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { FormError } from '@/components/common/FormError'
import { isConfigured } from '@/services/api/client'
import { saveQuotation, sendEmail, storeDocument } from '@/services/api/quotationApi'
import { inverterById } from '@/constants/catalogue'
import { computeTotals } from '@/services/pricing/costingEngine'
import { capacityFromPanels, computeQuotation } from '@/services/pricing/quotationEngine'
import { systemBomRows } from '@/services/quotation/documentBom'
import { buildWhatsAppUrl } from '@/services/quotation/whatsapp'
import { useAuthStore } from '@/stores/authStore'
import { useCostingStore } from '@/stores/costingStore'
import { useProjectsStore } from '@/stores/projectsStore'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'
import type { DocumentModel } from '@/services/export/documentModel'
import type { ProjectSummary } from '@/services/api/projectsApi'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; what: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; message: string }

export function ShareOptions({ values }: { values: QuotationFormValues }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [savedId, setSavedId] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')

  const token = useAuthStore((state) => state.token)
  const lines = useCostingStore((state) => state.lines)
  const resolveProjects = useProjectsStore((state) => state.resolve)
  const catalogue = useProjectsStore((state) => state.projects)
  const ratePerWatt = computeTotals(lines).totalRatePerWatt

  const capacityWp = capacityFromPanels(values.panels)
  const totals = computeQuotation({
    capacityWp,
    ratePerWatt,
    subsidyAmount: values.subsidyAmount,
  })

  const blocked = (): string | null => {
    if (!isConfigured()) return 'Backend not configured — set VITE_GAS_ENDPOINT in .env.local.'
    if (!token) return 'Sign in first.'
    return null
  }

  /**
   * The document model, with the selected projects' photographs resolved.
   *
   * Photographs are cached in the projects store, so exporting a PDF and then a Word
   * file fetches them once, not twice.
   *
   * `unavailable` names projects the catalogue promised photographs for that resolved
   * with none — a fetch failure, the one case the standing warning below cannot predict.
   * The document omits them, so the operator has to be told, or a quotation quietly
   * arrives shorter than the one they reviewed.
   */
  const buildModel = async (): Promise<{ model: DocumentModel; unavailable: string[] }> => {
    const { buildDocumentModel, hasPrintablePhotos } = await import(
      '@/services/export/exportQuotation'
    )
    const inverter = inverterById(values.inverterId)
    const projects = token ? await resolveProjects(token, values.referenceProjectIds ?? []) : []

    const unavailable = projects
      .filter((project) => !hasPrintablePhotos(project))
      .filter((project) => (catalogue.find((row) => row.id === project.id)?.imageCount ?? 0) > 0)
      .map((project) => project.name)

    const model = buildDocumentModel(
      {
        leadName: values.leadName,
        projectName: values.projectName,
        quotationNumber: values.quotationNumber,
        quotationDate: values.quotationDate,
        validityDays: values.validityDays,
        inverterKw: inverter ? inverter.capacityKw : 0,
        milestones: values.milestones,
        bom: [...systemBomRows(values.panels, values.inverterId), ...values.bom],
      },
      { ...totals, ratePerWatt },
      projects
    )

    return { model, unavailable }
  }

  /** Appends the photographs-missing note to a success message, when there is one. */
  const withNote = (message: string, unavailable: string[]): string =>
    unavailable.length === 0
      ? message
      : `${message} Photographs for ${unavailable.join(', ')} could not be loaded, so ` +
        `${unavailable.length === 1 ? 'it was' : 'they were'} left out of the document.`

  /** Writes the row to Google Sheets once, then reuses the id. */
  const ensureSaved = async (): Promise<string | null> => {
    if (savedId) return savedId

    setStatus({ kind: 'busy', what: 'Saving' })
    const result = await saveQuotation(token!, values, ratePerWatt)
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.message })
      return null
    }
    setSavedId(result.data.quotation.id)
    return result.data.quotation.id
  }

  const onDownload = async (format: 'pdf' | 'docx'): Promise<void> => {
    const stop = blocked()
    if (stop) return setStatus({ kind: 'error', message: stop })

    setStatus({ kind: 'busy', what: format === 'pdf' ? 'Building PDF' : 'Building Word' })
    try {
      const exporter = await import('@/services/export/exportQuotation')
      const { model, unavailable } = await buildModel()
      const blob =
        format === 'pdf'
          ? await exporter.renderPdfBlob(model)
          : await exporter.renderDocxBlob(model)

      exporter.saveBlob(blob, exporter.quotationFileName(values, format))
      setStatus({
        kind: 'done',
        message: withNote(`${format.toUpperCase()} downloaded.`, unavailable),
      })
    } catch (error) {
      setStatus({ kind: 'error', message: (error as Error).message })
    }
  }

  /**
   * Renders the PDF and files it in Drive.
   *
   * Rendering is client-side now, so the bytes travel up. Drive still matters because
   * WhatsApp shares a link, not a file.
   */
  const ensureStoredPdf = async (): Promise<{ url: string; base64: string } | null> => {
    const id = await ensureSaved()
    if (!id) return null

    setStatus({ kind: 'busy', what: 'Building PDF' })
    try {
      const exporter = await import('@/services/export/exportQuotation')
      const blob = await exporter.renderPdfBlob((await buildModel()).model)
      const pdfBase64 = await exporter.blobToBase64(blob)
      const fileName = exporter.quotationFileName(values, 'pdf')

      setStatus({ kind: 'busy', what: 'Uploading' })
      const result = await storeDocument(token!, values, ratePerWatt, { pdfBase64, fileName }, id)
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.message })
        return null
      }
      setPdfUrl(result.data.pdfUrl)
      return { url: result.data.pdfUrl, base64: pdfBase64 }
    } catch (error) {
      setStatus({ kind: 'error', message: (error as Error).message })
      return null
    }
  }

  const onEmail = async (): Promise<void> => {
    const stop = blocked()
    if (stop) return setStatus({ kind: 'error', message: stop })
    if (!values.email) {
      return setStatus({ kind: 'error', message: 'Add a client email address first.' })
    }

    const id = await ensureSaved()
    if (!id) return

    try {
      const exporter = await import('@/services/export/exportQuotation')
      setStatus({ kind: 'busy', what: 'Building PDF' })
      const { model, unavailable } = await buildModel()
      const blob = await exporter.renderPdfBlob(model)
      const pdfBase64 = await exporter.blobToBase64(blob)
      const fileName = exporter.quotationFileName(values, 'pdf')

      setStatus({ kind: 'busy', what: 'Sending email' })
      const result = await sendEmail(token!, values, ratePerWatt, { pdfBase64, fileName }, id)
      if (!result.ok) return setStatus({ kind: 'error', message: result.message })

      setPdfUrl(result.data.pdfUrl)
      setStatus({
        kind: 'done',
        message: withNote(
          `Sent to ${result.data.sentTo}. ${result.data.remainingQuota} email(s) left today.`,
          unavailable
        ),
      })
    } catch (error) {
      setStatus({ kind: 'error', message: (error as Error).message })
    }
  }

  /** Shares a real download link, so the message carries the document. */
  const onWhatsApp = async (): Promise<void> => {
    const stop = blocked()
    if (stop) return setStatus({ kind: 'error', message: stop })

    const stored = pdfUrl ? { url: pdfUrl } : await ensureStoredPdf()
    if (!stored) return

    const link = buildWhatsAppUrl(
      {
        leadName: values.leadName,
        quotationNumber: values.quotationNumber,
        phone: values.phone,
        capacityWp,
        priceInclGst: totals.priceInclGst,
        finalPayable: totals.finalPayable,
        subsidy: totals.subsidy,
      },
      stored.url
    )
    window.open(link, '_blank', 'noopener')
    setStatus({ kind: 'done', message: 'WhatsApp opened with the PDF link.' })
  }

  const busy = status.kind === 'busy'
  const label = (base: string, when: string): string =>
    busy && status.what === when ? `${status.what}…` : base

  const selectedIds = values.referenceProjectIds ?? []
  // Resolved against the catalogue, which the form has already loaded — imageCount is
  // metadata, so knowing this costs nothing. Until the catalogue arrives the ids are all
  // we have, and claiming "no photographs" then would be a lie.
  const selected = selectedIds
    .map((id) => catalogue.find((project) => project.id === id))
    .filter((project): project is ProjectSummary => project !== undefined)
  const known = selected.length === selectedIds.length
  const withoutPhotos = selected.filter((project) => project.imageCount === 0)
  const printableCount = known ? selected.length - withoutPhotos.length : selectedIds.length

  return (
    <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800/50">
      <Subheading>Share</Subheading>

      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={() => void onDownload('pdf')} disabled={busy}>
          <ArrowDownTrayIcon />
          {label('Download PDF', 'Building PDF')}
        </Button>

        <Button outline onClick={() => void onDownload('docx')} disabled={busy}>
          <DocumentTextIcon />
          {label('Download Word', 'Building Word')}
        </Button>

        <Button outline onClick={() => void onEmail()} disabled={busy || !values.email}>
          <EnvelopeIcon />
          {label('Email to client', 'Sending email')}
        </Button>

        <Button outline onClick={() => void onWhatsApp()} disabled={busy}>
          <ChatBubbleLeftRightIcon />
          {busy ? 'Preparing…' : 'Share PDF on WhatsApp'}
        </Button>
      </div>

      <Text className="mt-3 text-xs/5">
        {printableCount === 0
          ? 'No reference projects will be printed — that section will be omitted.'
          : `${printableCount} reference project${printableCount === 1 ? '' : 's'} will be included.`}
      </Text>

      {withoutPhotos.length > 0 && (
        <Text className="mt-2 text-xs/5 text-amber-600 dark:text-amber-500">
          {withoutPhotos.length} selected project{withoutPhotos.length === 1 ? ' has' : 's have'} no
          photographs and will not appear in the document:{' '}
          {withoutPhotos.map((project) => project.name).join(', ')}. Add photographs on the Projects
          page to include {withoutPhotos.length === 1 ? 'it' : 'them'}.
        </Text>
      )}

      {!values.email && <Text className="mt-2 text-xs/5">No client email on this quotation.</Text>}
      {!values.phone && (
        <Text className="mt-2 text-xs/5">
          No client phone — WhatsApp will open without a recipient.
        </Text>
      )}

      {status.kind === 'error' && <FormError className="mt-3">{status.message}</FormError>}
      {status.kind === 'done' && (
        <Text className="mt-3 text-xs/5 !text-green-700 dark:!text-green-400">
          {status.message}
        </Text>
      )}

      {pdfUrl && (
        <Text className="mt-3 text-xs/5">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline dark:text-blue-400"
          >
            Open the stored PDF
          </a>
        </Text>
      )}

      <Divider className="my-4" soft />
      <Text className="text-xs/5">
        Downloads are generated in your browser. Emailing and WhatsApp save the quotation to
        History first, so the PDF link is recorded against it.
      </Text>
    </div>
  )
}
