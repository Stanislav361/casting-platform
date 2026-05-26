'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { $session } from '@prostoprobuy/models'
import { Processor } from '~widgets/processor/processor'
import { readTelegramStartCastingId } from '~/shared/telegram-start-param'
import { setPendingReturnUrl } from '~/shared/pending-return-url'

const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager', 'admin', 'admin_pro']

export default function HomePage() {
	const router = useRouter()
	const [showProcessor, setShowProcessor] = useState(false)
	const [pendingCastingTarget, setPendingCastingTarget] = useState<string | null>(null)

	useEffect(() => {
		const castingId = readTelegramStartCastingId()
		const castingTarget = castingId ? `/cabinet/feed/${castingId}` : null

		const session = $session.getState()
		if (session?.access_token) {
			let role = 'user'
			try {
				role = JSON.parse(atob(session.access_token.split('.')[1])).role || 'user'
			} catch {}

			if (castingTarget) {
				router.replace(castingTarget)
				return
			}

			if (ADMIN_ROLES.includes(role)) {
				router.replace('/dashboard')
			} else {
				router.replace('/actor-home')
			}
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
