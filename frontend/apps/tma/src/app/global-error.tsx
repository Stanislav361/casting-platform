'use client'

import ErrorScreen from '~/app/error-screen'

/**
 * Падение самой разметки: здесь нужно отрисовать документ целиком, потому что
 * корневой layout до пользователя не доехал. Логика восстановления и отчёта —
 * общая с app/error.tsx (см. ErrorScreen).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
	return (
		<html lang="ru">
			<body style={{ margin: 0, background: '#0d0d0d' }}>
				<ErrorScreen error={error} source="global-error-boundary" />
			</body>
		</html>
	)
}
