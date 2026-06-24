'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { IconLoader } from '~packages/ui/icons'

export default function CabinetProfileIndexPage() {
	const router = useRouter()
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				// Список собственных анкет актёра (тот же endpoint, что в /cabinet)
				const data = await apiCall('GET', 'tma/actor-profiles/my/')
				if (cancelled) return
				const profiles = data?.profiles || data?.items || []
				// Открываем АКТИВНУЮ анкету (current_profile_id), а не всегда первую.
				const activeId = data?.current_profile_id ?? null
				const target = profiles.find((p: any) => p.id === activeId) || profiles[0]
				if (target?.id) {
					router.replace(`/cabinet/profile/${target.id}`)
					return
				}
				// Нет анкеты — отправляем к форме создания
				router.replace('/cabinet/profile/create')
			} catch (err: any) {
				if (!cancelled) setError(err?.message || 'Не удалось загрузить профиль')
			}
		})()
		return () => { cancelled = true }
	}, [router])

	return (
		<div style={{
			minHeight: '60vh',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			flexDirection: 'column',
			gap: 12,
			color: 'var(--c-text-2)',
		}}>
			{error ? (
				<>
					<p>{error}</p>
					<button
						onClick={() => router.push('/cabinet/profile/create')}
						style={{
							padding: '10px 20px',
							borderRadius: 12,
							border: '1px solid var(--c-gold-dim2)',
							background: 'var(--c-gold-dim)',
							color: 'var(--c-gold)',
							fontWeight: 700,
							cursor: 'pointer',
						}}
					>
						Создать профиль
					</button>
				</>
			) : (
				<>
					<IconLoader size={22} />
					<p>Открываем профиль…</p>
				</>
			)}
		</div>
	)
}
