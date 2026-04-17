'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { shouldShowNav } from '~/shared/nav-config'
import { useRole } from '~/shared/use-role'
import AppNav from './app-nav'

export default function AppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname()
	const role     = useRole()

	const showNav = Boolean(pathname && shouldShowNav(pathname) && role)

	return (
		<>
			<AppNav />
			<div className={showNav ? 'app-content app-content--with-nav' : 'app-content'}>
				{children}
			</div>
		</>
	)
}
