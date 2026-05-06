'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useRole } from '~/shared/use-role'

const ADMIN_ROLES = new Set(['owner', 'employer_pro', 'employer', 'administrator', 'manager'])

const STACK_KEY = '__app_nav_stack_v1'
const SESSION_FLAG = '__app_nav_session_v1'
const MAX_STACK = 50

/**
 * Maps logical child routes to their parent — fallback when nav stack has no
 * recorded predecessor (direct link, PWA cold start, refresh).
 */
const PARENT_MAP: Record<string, string> = {
	'/dashboard/castings':     '/dashboard',
	'/dashboard/castings/new': '/dashboard/castings',
	'/dashboard/actors':       '/dashboard',
	'/dashboard/reports':      '/dashboard',
	'/dashboard/team':         '/dashboard',
	'/dashboard/archive':      '/dashboard',
	'/chats':                  '/dashboard',
	'/settings':               '/dashboard',
	'/notifications':          '/dashboard',
	'/me':                     '/dashboard',
	'/actor-home':             '/',
	'/cabinet':                '/actor-home',
	'/cabinet/feed':           '/actor-home',
	'/cabinet/responses':      '/actor-home',
}

function getLogicalParent(url: URL): string {
	const pathname = url.pathname

	if (pathname === '/dashboard/castings/new') return '/dashboard/castings'
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

	const parts = pathname.split('/').filter(Boolean)
	if (parts.length > 1) return '/' + parts.slice(0, -1).join('/')

	return '/'
}

function readStack(): string[] {
	if (typeof window === 'undefined') return []
	try {
		const raw = sessionStorage.getItem(STACK_KEY)
		const arr = raw ? JSON.parse(raw) : []
		return Array.isArray(arr) ? arr : []
	} catch {
		return []
	}
}

function writeStack(stack: string[]) {
	if (typeof window === 'undefined') return
	try {
		sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)))
	} catch {}
}

/**
 * Records every client-side navigation into a session-scoped stack so the
 * back button knows where the user actually came from.
 *
 * Call once near the top of the app tree (e.g. in `AppShell`).
 */
export function useNavStackTracker() {
	const pathname = usePathname()
	const seededRef = useRef(false)

	useEffect(() => {
		if (typeof window === 'undefined' || !pathname) return

		// First mount in this React lifecycle (cold start / page reload):
		// reset the stack so we don't carry over stale entries from a previous
		// session — except keep the very first push for the entry route.
		if (!seededRef.current) {
			seededRef.current = true
			const isFreshSession = !sessionStorage.getItem(SESSION_FLAG)
			if (isFreshSession) {
				sessionStorage.setItem(SESSION_FLAG, '1')
				writeStack([pathname])
				return
			}
		}

		const stack = readStack()
		// Avoid double-pushing same path (router.replace, query updates).
		if (stack[stack.length - 1] === pathname) return
		stack.push(pathname)
		writeStack(stack)
	}, [pathname])
}

/**
 * Returns a `goBack` function that:
 *  1. Pops the previous entry from the navigation stack and pushes it (so the
 *     user lands exactly where they came from), OR
 *  2. Falls back to the supplied `overrideParent` (if provided), OR
 *  3. Falls back to the logical parent route from the URL.
 *
 * Role-aware: actor/agent destinations that resolve to /dashboard get
 * redirected to /actor-home instead.
 */
export function useSmartBack(overrideParent?: string) {
	const router = useRouter()
	const role   = useRole()

	const goBack = useCallback(() => {
		if (typeof window === 'undefined') return

		const isAdmin = role && ADMIN_ROLES.has(role)
		const stack = readStack()

		// Stack has both current page AND previous page → use stack
		if (stack.length >= 2) {
			let target = stack[stack.length - 2]
			// Drop current + previous entries; the upcoming navigation will
			// push the target back onto the stack via the tracker.
			writeStack(stack.slice(0, -2))

			// Role guards
			if (target === '/dashboard' && !isAdmin) target = '/actor-home'
			// Admins should never land on actor/agent-only routes
			if (isAdmin && (target === '/cabinet' || target === '/actor-home' || target.startsWith('/cabinet/'))) {
				target = '/dashboard'
			}

			router.push(target)
			return
		}

		// No history → logical parent
		let parent = overrideParent ?? getLogicalParent(new URL(window.location.href))
		if (parent === '/dashboard' && !isAdmin) parent = '/actor-home'
		if (isAdmin && (parent === '/cabinet' || parent === '/actor-home' || parent.startsWith('/cabinet/'))) {
			parent = '/dashboard'
		}

		router.replace(parent)
	}, [router, overrideParent, role])

	return goBack
}
