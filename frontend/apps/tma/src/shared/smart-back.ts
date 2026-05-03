'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Maps logical child routes to their parent.
 * Used as a fallback when browser history is unavailable
 * (direct link, PWA launch, page refresh).
 */
const PARENT_MAP: Record<string, string> = {
	'/dashboard/castings':  '/dashboard',
	'/dashboard/actors':    '/dashboard',
	'/dashboard/reports':   '/dashboard',
	'/dashboard/team':      '/dashboard',
	'/dashboard/archive':   '/dashboard',
	'/settings':            '/me',
	'/notifications':       '/me',
}

function getLogicalParent(pathname: string): string {
	// Exact match first
	if (PARENT_MAP[pathname]) return PARENT_MAP[pathname]

	// Dynamic segments: /dashboard/reports/123 → /dashboard/reports
	//                   /dashboard/actors/456  → /dashboard/actors
	//                   /dashboard/project/789 → /dashboard
	const reportMatch = pathname.match(/^(\/dashboard\/reports)\//)
	if (reportMatch) return reportMatch[1]

	const actorsMatch = pathname.match(/^(\/dashboard\/actors)\//)
	if (actorsMatch) return actorsMatch[1]

	const projectMatch = pathname.match(/^\/dashboard\/project\/\d+/)
	if (projectMatch) return '/dashboard'

	const cabinetMatch = pathname.match(/^(\/cabinet\/[^/]+)\//)
	if (cabinetMatch) return cabinetMatch[1]

	// Default: go one level up
	const parts = pathname.split('/').filter(Boolean)
	if (parts.length > 1) return '/' + parts.slice(0, -1).join('/')

	return '/'
}

/**
 * Returns a `goBack` function that uses browser history when available,
 * falling back to a logical parent route derived from PARENT_MAP.
 */
export function useSmartBack(overrideParent?: string) {
	const router = useRouter()

	const goBack = useCallback(() => {
		if (typeof window === 'undefined') return

		if (window.history.length > 1) {
			router.back()
			return
		}

		const parent = overrideParent ?? getLogicalParent(window.location.pathname)
		router.replace(parent)
	}, [router, overrideParent])

	return goBack
}
