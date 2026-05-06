'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '~/shared/use-role'

const ADMIN_ROLES = new Set(['owner', 'employer_pro', 'employer', 'administrator', 'manager'])

/**
 * Maps logical child routes to their parent.
 * Used as a fallback when browser history is unavailable
 * (direct link, PWA launch, page refresh).
 */
const PARENT_MAP: Record<string, string> = {
	'/dashboard/castings':    '/dashboard',
	'/dashboard/castings/new': '/dashboard/castings',
	'/dashboard/actors':      '/dashboard',
	'/dashboard/reports':     '/dashboard',
	'/dashboard/team':        '/dashboard',
	'/dashboard/archive':     '/dashboard',
	'/chats':                 '/dashboard',
	'/settings':              '/dashboard',
	'/notifications':         '/dashboard',
	'/me':                    '/dashboard',
	// Actor/agent hub
	'/actor-home':            '/',
	'/cabinet':               '/actor-home',
	'/cabinet/feed':          '/actor-home',
	'/cabinet/responses':     '/actor-home',
}

function getLogicalParent(url: URL): string {
	const pathname = url.pathname

	if (pathname === '/dashboard/castings/new') return '/dashboard/castings'
	if (pathname === '/dashboard/castings') return PARENT_MAP[pathname]
	if (PARENT_MAP[pathname]) return PARENT_MAP[pathname]

	const castingMatch = pathname.match(/^\/dashboard\/castings\/\d+/)
	if (castingMatch) return '/dashboard/castings'

	const reportMatch = pathname.match(/^(\/dashboard\/reports)\//)
	if (reportMatch) return reportMatch[1]

	const actorsMatch = pathname.match(/^(\/dashboard\/actors)\//)
	if (actorsMatch) return actorsMatch[1]

	const projectMatch = pathname.match(/^\/dashboard\/project\/\d+/)
	if (projectMatch) return '/dashboard'

	const chatMatch = pathname.match(/^\/chats\/[^/]+/)
	if (chatMatch) return '/chats'

	const cabinetProfileEditMatch = pathname.match(/^\/cabinet\/profile\/([^/]+)\/edit/)
	if (cabinetProfileEditMatch) return `/cabinet/profile/${cabinetProfileEditMatch[1]}`

	const cabinetProfileMediaMatch = pathname.match(/^\/cabinet\/profile\/([^/]+)\/media/)
	if (cabinetProfileMediaMatch) return `/cabinet/profile/${cabinetProfileMediaMatch[1]}`

	const cabinetFeedMatch = pathname.match(/^\/cabinet\/feed\/[^/]+/)
	if (cabinetFeedMatch) return '/cabinet/feed'

	const cabinetProfileMatch = pathname.match(/^\/cabinet\/profile\/[^/]+/)
	if (cabinetProfileMatch) return '/cabinet'

	const cabinetMatch = pathname.match(/^(\/cabinet\/[^/]+)\//)
	if (cabinetMatch) return cabinetMatch[1]

	// Default: go one level up
	const parts = pathname.split('/').filter(Boolean)
	if (parts.length > 1) return '/' + parts.slice(0, -1).join('/')

	return '/'
}

/**
 * Returns a `goBack` function that navigates to the logical parent route.
 * Role-aware: actor/agent routes that would land on /dashboard are
 * redirected to /actor-home instead.
 */
export function useSmartBack(overrideParent?: string) {
	const router = useRouter()
	const role   = useRole()

	const goBack = useCallback(() => {
		if (typeof window === 'undefined') return

		let parent = overrideParent ?? getLogicalParent(new URL(window.location.href))

		// For actor/agent roles, any "admin hub" destination becomes the actor hub
		if (parent === '/dashboard' && role && !ADMIN_ROLES.has(role)) {
			parent = '/actor-home'
		}

		router.replace(parent)
	}, [router, overrideParent, role])

	return goBack
}
