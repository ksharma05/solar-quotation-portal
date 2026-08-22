import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/16/solid'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/ui/dropdown'
import { NavbarItem } from '@/components/ui/navbar'
import { useUIStore, type Theme } from '@/stores/uiStore'

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'auto', label: 'System', Icon: ComputerDesktopIcon },
]

export function ThemeToggle() {
  const theme = useUIStore((state) => state.theme)
  const setTheme = useUIStore((state) => state.setTheme)
  const active = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[2]

  return (
    <Dropdown>
      <DropdownButton as={NavbarItem} aria-label={`Theme: ${active.label}`}>
        <active.Icon />
      </DropdownButton>
      <DropdownMenu anchor="bottom end">
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownItem key={value} onClick={() => setTheme(value)}>
            <Icon data-slot="icon" />
            <DropdownLabel>{label}</DropdownLabel>
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}
