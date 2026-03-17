'use client'

import { useEffect } from 'react'

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error('[App Error]', error)
	}, [error])

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				height: '100vh',
				background: '#0d0d0d',
				color: '#fff',
				fontFamily: 'system-ui, sans-serif',
				padding: 24,
				textAlign: 'center',
			}}
		>
			<div style={{
				width: 64, height: 64, borderRadius: 20,
				background: 'rgba(245, 197, 24, 0.1)',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				marginBottom: 20, fontSize: 28,
			}}>
				!
			</div>
			<h1 style={{ fontSize: 24, marginBottom: 8, fontWeight: 700 }}>Произошла ошибка</h1>
			<p style={{ color: '#888', marginBottom: 28, maxWidth: 360, fontSize: 14, lineHeight: 1.5 }}>
				Попробуйте обновить страницу. Если проблема повторяется — очистите кэш браузера или войдите заново.
			</p>
			<button
				onClick={reset}
				style={{
					padding: '12px 32px',
					borderRadius: 10,
					border: 'none',
					background: '#f5c518',
					color: '#000',
					fontSize: 15,
					fontWeight: 700,
					cursor: 'pointer',
					marginBottom: 12,
				}}
			>
				Обновить страницу
			</button>
			<a
				href="/login"
				style={{ color: '#f5c518', fontSize: 13, textDecoration: 'none', marginTop: 4 }}
			>
				← На страницу входа
			</a>
		</div>
	)
}
