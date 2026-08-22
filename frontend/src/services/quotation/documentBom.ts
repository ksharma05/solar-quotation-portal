import { inverterById, panelById } from '@/constants/catalogue'
import type { BomSpecRow } from '@/constants/bomDefaults'
import type { PanelSelection } from '@/services/pricing/quotationEngine'
import { capacityFromPanels, panelCount } from '@/services/pricing/quotationEngine'

/**
 * The Panels and Inverter rows of the customer BOM, generated from the system
 * configuration so they can never drift from the priced capacity.
 *
 * Phrasing follows the sample documents, which describe a mixed system as
 * "Monocrystalline – 10280 Watt – 590 & 615 watt/Panel = 17 Panels".
 */
export function systemBomRows(
  panels: PanelSelection[],
  inverterId: string
): BomSpecRow[] {
  const rows: BomSpecRow[] = []

  const selected = panels
    .map((selection) => ({ panel: panelById(selection.panelId), count: selection.count }))
    .filter(
      (entry): entry is { panel: NonNullable<ReturnType<typeof panelById>>; count: number } =>
        Boolean(entry.panel) && Number.isFinite(entry.count) && entry.count > 0
    )

  if (selected.length > 0) {
    const capacityWp = capacityFromPanels(panels)
    const total = panelCount(panels)
    const wattages = [...new Set(selected.map((entry) => entry.panel.wattage))]

    rows.push({
      material: 'Panels',
      details: selected
        .map((entry) => `${entry.panel.name}:- ${entry.panel.wattage}Wp (${entry.count} no.)`)
        .join(', '),
      quantity: `Monocrystalline – ${capacityWp} Watt – ${wattages.join(' & ')} watt/Panel = ${total} Panels`,
      // Uniform across the catalogue; taken from the first selection.
      warranty: selected[0].panel.warranty,
    })
  }

  const inverter = inverterById(inverterId)
  if (inverter) {
    rows.push({
      material: 'Inverter',
      details: inverter.name,
      quantity: `${inverter.capacityKw} KW - ${inverter.phase}`,
      warranty: inverter.warranty,
    })
  }

  return rows
}
