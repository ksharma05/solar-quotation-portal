/**
 * Catalyst ships this component as a bare <a> with a TODO to wire it to the app's
 * router. Every Sidebar/Navbar/Dropdown item routes through it, so without this
 * every click would trigger a full page reload.
 *
 * https://catalyst.tailwindui.com/docs#client-side-router-integration
 */

import * as Headless from '@headlessui/react'
import React, { forwardRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'

/** Absolute URLs (http:, mailto:, tel:, //host) and bare fragments bypass the router. */
function isExternal(href: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || href.startsWith('#')
}

export const Link = forwardRef(function Link(
  props: { href: string } & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const { href, ...rest } = props

  if (isExternal(href)) {
    return (
      <Headless.DataInteractive>
        <a href={href} {...rest} ref={ref} />
      </Headless.DataInteractive>
    )
  }

  return (
    <Headless.DataInteractive>
      <RouterLink to={href} {...rest} ref={ref} />
    </Headless.DataInteractive>
  )
})
