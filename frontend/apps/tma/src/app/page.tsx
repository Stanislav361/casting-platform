'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { $session } from '@prostoprobuy/models'
import { links } from '@prostoprobuy/links'

export default function HomePage() {
	const router = useRouter()

	useEffect(() => {
		const session = $session.getState()
		if (session?.access_token) {
			router.replace(links.profile.form)
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
