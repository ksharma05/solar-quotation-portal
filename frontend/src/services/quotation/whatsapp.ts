import { COMPANY } from '@/constants/config'
import { printsSubsidy } from '@/services/pricing/quotationEngine'
import { formatINR } from '@/utils/formatters'

/**
 * wa.me deep link — free, no API, no template approval.
 *
 * Built client-side so the operator gets the link instantly without a round-trip.
 * Mirrors backend/google-apps-script/Share.gs; a parity test keeps the two in step.
 */

/** Normalises an Indian mobile number to the 91XXXXXXXXXX form wa.me expects. */
export function normaliseWhatsAppNumber(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return '91' + digits
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1)
  return digits
}

export interface WhatsAppInput {
  leadName: string
  quotationNumber: string
  phone?: string
  capacityWp: number
  priceInclGst: number
  finalPayable: number
  subsidy: number
}

export function buildWhatsAppMessage(input: WhatsAppInput, pdfUrl: string): string {
  const capacityKw = (input.capacityWp / 1000).toFixed(2)
  const lines = [
    `Hi ${input.leadName},`,
    '',
    'Your solar quotation is ready.',
    '',
    `System capacity: ${capacityKw} kW`,
    `Total cost (incl. GST): ${formatINR(input.priceInclGst)}`,
  ]

  if (printsSubsidy(input.subsidy)) {
    lines.push(`After subsidy: ${formatINR(input.finalPayable)}`)
  }

  if (pdfUrl) {
    lines.push('', `Download PDF: ${pdfUrl}`)
  }

  lines.push('', `Quotation No.: ${input.quotationNumber}`, '', COMPANY.name, COMPANY.phone)

  return lines.join('\n')
}

export function buildWhatsAppUrl(input: WhatsAppInput, pdfUrl = ''): string {
  const number = normaliseWhatsAppNumber(input.phone ?? '')
  const text = encodeURIComponent(buildWhatsAppMessage(input, pdfUrl))
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`
}
