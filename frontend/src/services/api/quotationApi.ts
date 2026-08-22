import { post, type ApiResult } from '@/services/api/client'
import { inverterById, panelById } from '@/constants/catalogue'
import { capacityFromPanels, panelCount } from '@/services/pricing/quotationEngine'
import { systemBomRows } from '@/services/quotation/documentBom'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

export interface SavedQuotation {
  id: string
  quotationNumber: string
  quotationDate: string
  leadName: string
  projectName: string
  email: string
  phone: string
  capacityWp: number
  ratePerWatt: number
  priceExclGst: number
  priceInclGst: number
  subsidy: number
  finalPayable: number
  panelSummary: string
  inverterSummary: string
  pdfUrl: string
  createdAt: string
  milestones: { percentage: number; description: string }[]
  bom: { material: string; details: string; quantity: string; warranty: string }[]
}

export interface QuotationPage {
  rows: SavedQuotation[]
  total: number
  page: number
  pageSize: number
}

/**
 * Sends inputs only — capacity, rate and subsidy. The server recomputes every total,
 * so a tampered or stale client cannot write a wrong price into the sheet.
 */
export function saveQuotation(
  token: string,
  values: QuotationFormValues,
  ratePerWatt: number
): Promise<ApiResult<{ quotation: SavedQuotation }>> {
  const capacityWp = capacityFromPanels(values.panels)
  const inverter = inverterById(values.inverterId)

  const panelSummary = values.panels
    .map((selection) => {
      const panel = panelById(selection.panelId)
      return panel ? `${panel.name} ${panel.wattage}Wp x ${selection.count}` : ''
    })
    .filter(Boolean)
    .join(', ')

  return post('saveQuotation', {
    token,
    quotation: {
      leadName: values.leadName,
      projectName: values.projectName,
      email: values.email ?? '',
      phone: values.phone ?? '',
      quotationNumber: values.quotationNumber,
      quotationDate: values.quotationDate,
      validityDays: values.validityDays,
      capacityWp,
      ratePerWatt,
      subsidyAmount: values.subsidyAmount,
      inverterKw: inverter ? inverter.capacityKw : 0,
      panelSummary: `${panelSummary} (${panelCount(values.panels)} panels)`,
      inverterSummary: inverter ? `${inverter.name} ${inverter.capacityKw} kW` : '',
      milestones: values.milestones,
      bom: [...systemBomRows(values.panels, values.inverterId), ...values.bom],
    },
  })
}

export function listQuotations(
  token: string,
  { page = 1, pageSize = 20, search = '' }: { page?: number; pageSize?: number; search?: string }
): Promise<ApiResult<QuotationPage>> {
  return post('listQuotations', { token, page, pageSize, search })
}

export function getQuotation(
  token: string,
  id: string
): Promise<ApiResult<{ quotation: SavedQuotation }>> {
  return post('getQuotation', { token, id })
}

/** Payload shared by the PDF and email actions. */
function quotationPayload(values: QuotationFormValues, ratePerWatt: number) {
  const inverter = inverterById(values.inverterId)
  return {
    leadName: values.leadName,
    projectName: values.projectName,
    email: values.email ?? '',
    phone: values.phone ?? '',
    quotationNumber: values.quotationNumber,
    quotationDate: values.quotationDate,
    validityDays: values.validityDays,
    capacityWp: capacityFromPanels(values.panels),
    ratePerWatt,
    subsidyAmount: values.subsidyAmount,
    inverterKw: inverter ? inverter.capacityKw : 0,
    milestones: values.milestones,
    bom: [...systemBomRows(values.panels, values.inverterId), ...values.bom],
  }
}

export function generatePdf(
  token: string,
  values: QuotationFormValues,
  ratePerWatt: number,
  id?: string
): Promise<ApiResult<{ pdfUrl: string; fileId: string; name: string }>> {
  // PDF rendering runs inside Apps Script and can take a while on a cold start.
  return post(
    'generatePdf',
    { token, id, quotation: quotationPayload(values, ratePerWatt) },
    { timeoutMs: 60_000 }
  )
}

export function sendEmail(
  token: string,
  values: QuotationFormValues,
  ratePerWatt: number,
  id?: string
): Promise<ApiResult<{ sentTo: string; remainingQuota: number; pdfUrl: string }>> {
  return post(
    'sendEmail',
    { token, id, quotation: quotationPayload(values, ratePerWatt) },
    { timeoutMs: 60_000 }
  )
}

export interface DiagnosticsResult {
  checks: Record<string, { ok: boolean; detail: string }>
  failures: string[]
}

/** Probes each Google service the backend needs — fastest way to spot a missing scope. */
export function diagnostics(token: string): Promise<ApiResult<DiagnosticsResult>> {
  return post('diagnostics', { token }, { timeoutMs: 60_000 })
}
