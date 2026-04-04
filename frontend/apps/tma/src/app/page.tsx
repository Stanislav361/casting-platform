'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { $session } from '@prostoprobuy/models'

export default function HomePage() {
	const router = useRouter()

	useEffect(() => {
		const session = $session.getState()
		if (session?.access_token) {
			let role = 'user'
			try {
				role = JSON.parse(atob(session.access_token.split('.')[1])).role || 'user'
			} catch {}

			if (role === 'owner' || role === 'admin' || role === 'admin_pro') {
				router.replace('/dashboard')
			} else {
				router.replace('/cabinet/feed')
			}
			return
		}

		const isTelegram =
			typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData

		if (isTelegram) {
			const loadProcessor = async () => {
				try {
					const { Processor } = await import('~widgets/processor/processor')
					return <Processor />
				} catch {
					router.replace('/login')
				}
			}
			loadProcessor()
		} else {
			router.replace('/login')
		}
	}, [router])

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
