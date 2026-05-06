'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { shouldShowNav } from '~/shared/nav-config'
import { useRole } from '~/shared/use-role'
import { useNavStackTracker } from '~/shared/smart-back'
import AppNav from './app-nav'

export default function AppShell({ children }: { children: ReactNode }) {
	useNavStackTracker()
	const pathname = usePathname()
	const role     = useRole()

	const showNav = Boolean(pathname && shouldShowNav(pathname) && role)
	// All roles now use hub-page navigation — no floating top bar on mobile.
	// Use admin-nav class (safe-area-inset-top padding, no 82px top reservation).
	const cls = showNav ? 'app-content app-content--admin-nav' : 'app-content'

	return (
		<>
			<AppNav />
			<div className={cls}>
				{children}
			</div>
		</>
	)
}
