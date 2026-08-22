import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArchiveBoxIcon,
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  HomeIcon,
} from '@heroicons/react/20/solid'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/ui/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '@/components/ui/sidebar'
import { SidebarLayout } from '@/components/ui/sidebar-layout'
import { Text } from '@/components/ui/text'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { COMPANY } from '@/constants/config'
import { isConfigured } from '@/services/api/client'
import { useAuthStore } from '@/stores/authStore'

const NAV = [
  { href: '/', label: 'Dashboard', Icon: HomeIcon },
  { href: '/costing', label: 'Costing Sheet', Icon: CurrencyRupeeIcon },
  { href: '/quotation', label: 'New Quotation', Icon: DocumentTextIcon },
  { href: '/history', label: 'History', Icon: ArchiveBoxIcon },
]

export function MainLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const signOut = useAuthStore((state) => state.signOut)
  const token = useAuthStore((state) => state.token)

  const isCurrent = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <ThemeToggle />
            {token && (
              <NavbarItem
                aria-label="Sign out"
                onClick={() => {
                  signOut()
                  navigate('/login', { replace: true })
                }}
              >
                <ArrowRightStartOnRectangleIcon />
              </NavbarItem>
            )}
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2 py-2.5">
              <img
                src="/logo.png"
                alt=""
                className="size-9 shrink-0 rounded-md bg-white object-contain p-0.5"
              />
              <div className="min-w-0">
                <div className="truncate text-sm/5 font-semibold text-zinc-950 dark:text-white">
                  {COMPANY.name}
                </div>
                <div className="truncate text-xs/5 text-zinc-500 dark:text-zinc-400">
                  {COMPANY.address}
                </div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {NAV.map(({ href, label, Icon }) => (
                <SidebarItem key={href} href={href} current={isCurrent(href)}>
                  <Icon data-slot="icon" />
                  <SidebarLabel>{label}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarHeading>Configuration</SidebarHeading>
              <SidebarItem href="/settings" current={isCurrent('/settings')}>
                <Cog6ToothIcon data-slot="icon" />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter className="max-lg:hidden">
            <Text className="px-2 text-xs/5">GSTIN {COMPANY.gstin}</Text>
            {!isConfigured() && (
              <Text className="px-2 text-xs/5">Local mode — no backend</Text>
            )}
          </SidebarFooter>
        </Sidebar>
      }
    >
      <Outlet />
    </SidebarLayout>
  )
}
