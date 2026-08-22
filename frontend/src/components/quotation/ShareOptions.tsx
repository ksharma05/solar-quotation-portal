import { useState } from 'react'
import {
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
} from '@heroicons/react/16/solid'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { FormError } from '@/components/common/FormError'
import { isConfigured } from '@/services/api/client'
import { generatePdf, saveQuotation, sendEmail } from '@/services/api/quotationApi'
import { computeTotals } from '@/services/pricing/costingEngine'
import { capacityFromPanels, computeQuotation } from '@/services/pricing/quotationEngine'
import { buildWhatsAppUrl } from '@/services/quotation/whatsapp'
import { useAuthStore } from '@/stores/authStore'
import { useCostingStore } from '@/stores/costingStore'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

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

  /** Saves first so the generated PDF's URL is recorded against the stored row. */
  const ensurePdf = async (): Promise<string | null> => {
    if (pdfUrl) return pdfUrl

    const id = await ensureSaved()
    if (!id) return null

    setStatus({ kind: 'busy', what: 'Generating PDF' })
    const result = await generatePdf(token!, values, ratePerWatt, id)
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.message })
      return null
    }
    setPdfUrl(result.data.pdfUrl)
    return result.data.pdfUrl
  }

  const onDownload = async (): Promise<void> => {
    const stop = blocked()
    if (stop) return setStatus({ kind: 'error', message: stop })

    const url = await ensurePdf()
    if (!url) return
    window.open(url, '_blank', 'noopener')
    setStatus({ kind: 'done', message: 'PDF generated and saved to history.' })
  }

  const onEmail = async (): Promise<void> => {
    const stop = blocked()
    if (stop) return setStatus({ kind: 'error', message: stop })
    if (!values.email) {
      return setStatus({ kind: 'error', message: 'Add a client email address first.' })
    }

    const id = await ensureSaved()
    if (!id) return

    setStatus({ kind: 'busy', what: 'Sending email' })
    const result = await sendEmail(token!, values, ratePerWatt, id)
    if (!result.ok) return setStatus({ kind: 'error', message: result.message })

    setPdfUrl(result.data.pdfUrl)
    setStatus({
      kind: 'done',
      message: `Sent to ${result.data.sentTo}. ${result.data.remainingQuota} email(s) left today.`,
    })
  }

  /**
   * Generates the PDF first so the message carries a real download link — sharing a
   * quotation without the document attached is the whole point of the button.
   */
  const onWhatsApp = async (): Promise<void> => {
    const stop = blocked()
    if (stop) return setStatus({ kind: 'error', message: stop })

    const url = await ensurePdf()
    if (!url) return

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
      url
    )
    window.open(link, '_blank', 'noopener')
    setStatus({ kind: 'done', message: 'WhatsApp opened with the PDF link.' })
  }

  const busy = status.kind === 'busy'
  const label = (base: string, when: string): string =>
    busy && status.what === when ? `${status.what}…` : base

  return (
    <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800/50">
      <Subheading>Share</Subheading>

      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={onDownload} disabled={busy}>
          <ArrowDownTrayIcon />
          {label('Download PDF', 'Generating PDF')}
        </Button>

        <Button outline onClick={onEmail} disabled={busy || !values.email}>
          <EnvelopeIcon />
          {label('Email to client', 'Sending email')}
        </Button>

        <Button outline onClick={onWhatsApp} disabled={busy}>
          <ChatBubbleLeftRightIcon />
          {busy ? 'Preparing…' : 'Share PDF on WhatsApp'}
        </Button>
      </div>

      {!values.email && <Text className="mt-3 text-xs/5">No client email on this quotation.</Text>}
      {!values.phone && (
        <Text className="mt-3 text-xs/5">
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
            Open the generated PDF
          </a>
        </Text>
      )}

      <Divider className="my-4" soft />
      <Text className="text-xs/5">
        Each action saves the quotation to History first, so the PDF link is recorded against
        it. WhatsApp opens with the message pre-filled — nothing is sent automatically.
      </Text>
    </div>
  )
}
