'use client'

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
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
			<h1 style={{ fontSize: 28, marginBottom: 12 }}>Что-то пошло не так</h1>
			<p style={{ color: '#888', marginBottom: 24, maxWidth: 400 }}>
				{error.message || 'Произошла непредвиденная ошибка'}
			</p>
			<button
				onClick={reset}
				style={{
					padding: '12px 32px',
					borderRadius: 10,
					border: 'none',
					background: '#f5c518',
					color: '#000',
					fontSize: 16,
					fontWeight: 600,
					cursor: 'pointer',
					marginBottom: 12,
				}}
			>
				Попробовать снова
			</button>
			<a
				href="/login"
				style={{ color: '#f5c518', fontSize: 14, textDecoration: 'none' }}
			>
				← Вернуться на страницу входа
			</a>
		</div>
	)
}
