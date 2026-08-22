import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { REFERENCE_CAPACITY_W } from '@/constants/costingLines'
import {
  computeTotals,
  createLines,
  recalcAll,
  setLinePrice,
  setLineRate,
} from '@/services/pricing/costingEngine'
import type { CostingLine, CostingTotals } from '@/types'

interface CostingState {
  /** Free-text label for the job this sheet costs, e.g. "125 KW Waaree Mittal Hospital". */
  title: string
  capacityW: number
  lines: CostingLine[]

  setTitle: (title: string) => void
  setCapacity: (capacityW: number) => void
  updatePrice: (id: string, price: number) => void
  updateRate: (id: string, rate: number) => void
  resetToReference: () => void

  totals: () => CostingTotals
}

export const useCostingStore = create<CostingState>()(
  persist(
    (set, get) => ({
      title: '',
      capacityW: REFERENCE_CAPACITY_W,
      lines: createLines(REFERENCE_CAPACITY_W),

      setTitle: (title) => set({ title }),

      setCapacity: (capacityW) =>
        set((state) => ({ capacityW, lines: recalcAll(state.lines, capacityW) })),

      updatePrice: (id, price) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.id === id ? setLinePrice(line, price, state.capacityW) : line
          ),
        })),

      updateRate: (id, rate) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.id === id ? setLineRate(line, rate, state.capacityW) : line
          ),
        })),

      resetToReference: () =>
        set({
          title: '',
          capacityW: REFERENCE_CAPACITY_W,
          lines: createLines(REFERENCE_CAPACITY_W),
        }),

      totals: () => computeTotals(get().lines),
    }),
    {
      name: 'sgt-costing',
      partialize: (state) => ({
        title: state.title,
        capacityW: state.capacityW,
        lines: state.lines,
      }),
    }
  )
)
