'use client'

import ErrorScreen from '~/app/error-screen'

/**
 * Граница ошибок внутри общей разметки. Вся логика (отчёт в лог сервера и сброс
 * устаревшего кеша PWA) живёт в ErrorScreen — она общая с global-error.tsx.
 */
export default function RootError({ error }: { error: Error & { digest?: string } }) {
	return <ErrorScreen error={error} source="error-boundary" />
}
