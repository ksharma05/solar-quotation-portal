import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SUBSIDY_AMOUNT, QUOTE_VALIDITY_DAYS } from '@/constants/config'

/**
 * Operator-configurable defaults. These seed a new quotation; each one stays
 * editable per quote. Kept separate from constants/config.ts so the subsidy figure
 * can change when the scheme rate does, without a code edit.
 */
interface SettingsState {
  subsidyDefault: number
  validityDaysDefault: number
  setSubsidyDefault: (value: number) => void
  setValidityDaysDefault: (value: number) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      subsidyDefault: DEFAULT_SUBSIDY_AMOUNT,
      validityDaysDefault: QUOTE_VALIDITY_DAYS,

      setSubsidyDefault: (value) =>
        set({ subsidyDefault: Number.isFinite(value) && value >= 0 ? value : 0 }),

      setValidityDaysDefault: (value) =>
        set({
          validityDaysDefault:
            Number.isFinite(value) && value >= 1 ? Math.trunc(value) : QUOTE_VALIDITY_DAYS,
        }),

      reset: () =>
        set({
          subsidyDefault: DEFAULT_SUBSIDY_AMOUNT,
          validityDaysDefault: QUOTE_VALIDITY_DAYS,
        }),
    }),
    { name: 'sgt-settings' }
  )
)
