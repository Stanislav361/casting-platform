'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { $session } from '@prostoprobuy/models'
import { Processor } from '~widgets/processor/processor'

export default function HomePage() {
	const router = useRouter()
	const [showProcessor, setShowProcessor] = useState(false)

	useEffect(() => {
		const session = $session.getState()
		if (session?.access_token) {
			let role = 'user'
			try {
				role = JSON.parse(atob(session.access_token.split('.')[1])).role || 'user'
			} catch {}

			const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager', 'admin', 'admin_pro']
			if (ADMIN_ROLES.includes(role)) {
				router.replace('/dashboard')
			} else {
				router.replace('/actor-home')
			}
			return
		}

		const isTelegram =
			typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData

		if (isTelegram) {
			setShowProcessor(true)
		} else {
			router.replace('/login')
		}
	}, [router])

	if (showProcessor) return <Processor />

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
