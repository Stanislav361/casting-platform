'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { shouldShowNav } from '~/shared/nav-config'
import { useRole } from '~/shared/use-role'
import AppNav from './app-nav'

const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager']

export default function AppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname()
	const role     = useRole()

	const showNav    = Boolean(pathname && shouldShowNav(pathname) && role)
	// Для admin-ролей верхний floating bar скрыт — не нужен верхний padding.
	const hasTopBar  = showNav && !ADMIN_ROLES.includes(role ?? '')

	const cls = showNav
		? hasTopBar ? 'app-content app-content--with-nav' : 'app-content app-content--admin-nav'
		: 'app-content'

	return (
		<>
			<AppNav />
			<div className={cls}>
				{children}
			</div>
		</>
	)
}
