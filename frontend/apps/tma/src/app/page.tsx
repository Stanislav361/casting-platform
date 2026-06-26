'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Processor } from '~widgets/processor/processor'
import { readTelegramStartCastingId } from '~/shared/telegram-start-param'
import { setPendingReturnUrl } from '~/shared/pending-return-url'
import { ensureAccessToken } from '~/shared/api-client'

const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager', 'admin', 'admin_pro']

const getRoleFromToken = (token: string): string => {
	try {
		const rawToken = token.includes(' ') ? token.split(' ').pop() : token
		return JSON.parse(atob(rawToken?.split('.')[1] || '')).role || 'user'
	} catch {
		return 'user'
	}
}

export default function HomePage() {
	const router = useRouter()
	const [showProcessor, setShowProcessor] = useState(false)
	const [pendingCastingTarget, setPendingCastingTarget] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		const route = async () => {
			let isSuperAdminSource = false
			try {
				const url = new URL(window.location.href)
				isSuperAdminSource = url.searchParams.get('source') === 'pwa-admin'
			} catch {}

			const castingId = readTelegramStartCastingId()
			const castingTarget = castingId ? `/cabinet/feed/${castingId}` : null
			const token = await ensureAccessToken()
			if (cancelled) return

			if (token) {
				const role = getRoleFromToken(token)
				if (isSuperAdminSource && role === 'owner') {
					router.replace('/dashboard/admin')
					return
				}
				if (isSuperAdminSource) {
					router.replace('/admin-login?source=pwa-admin')
					return
				}
				if (castingTarget && !ADMIN_ROLES.includes(role)) {
					router.replace(castingTarget)
					return
				}
				router.replace(ADMIN_ROLES.includes(role) ? '/dashboard' : '/actor-home')
				return
			}

			if (isSuperAdminSource) {
				router.replace('/admin-login?source=pwa-admin')
				return
			}

			if (castingTarget) {
				setPendingReturnUrl(castingTarget)
			}

			const isTelegram =
				typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData

			if (isTelegram) {
				if (castingTarget) setPendingCastingTarget(castingTarget)
				setShowProcessor(true)
			} else {
				router.replace(castingTarget ? `/login?next=${encodeURIComponent(castingTarget)}` : '/login')
			}
		}

		route()
		return () => { cancelled = true }
	}, [router])

	if (showProcessor) return <Processor returnUrl={pendingCastingTarget ?? undefined} />

	return (
		<div style={{
			display: 'flex', width: '100%', height: '100vh',
			alignItems: 'center', justifyContent: 'center',
			background: '#0d0d0d', color: '#fff'
		}}>
			<p>Загрузка...</p>
		</div>
	)
}
