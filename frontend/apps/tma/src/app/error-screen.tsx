'use client'

/**
 * Экран падения приложения — общий для обеих границ ошибок Next.js
 * (app/error.tsx и app/global-error.tsx).
 *
 * Кроме текста здесь два обязательных действия, которых раньше не было:
 *
 * 1. Отчёт об ошибке уходит в лог сервера. Границы ошибок React не поднимают
 *    падение в window.onerror, поэтому в логах не оставалось ничего — причину
 *    инцидента приходилось угадывать по скриншотам.
 * 2. Приложение лечит себя само, если в кеше PWA осталась прошлая сборка. Кнопка
 *    «Обновить страницу» раньше вызывала reset() — повторный рендер тем же
 *    сломанным бандлом, то есть снова пустой экран. Теперь и автоматика, и
 *    кнопка сбрасывают кеш и открывают приложение заново.
 */

import { useEffect, useState } from 'react'
import {
	describeError,
	isRecoverableStartupFailure,
	looksLikeStaleBundle,
	recoverApp,
} from '~/shared/app-recovery'
import { resetPwaCachesAndReload } from '~/shared/pwa-reset'
import { reportClientError, type ClientErrorSource } from '~/shared/report-client-error'

type Props = {
	error: Error & { digest?: string }
	source: ClientErrorSource
}

/** Короткий код для обращения в поддержку: по нему ошибку видно в логах. */
const errorCode = (error: Error & { digest?: string }): string => {
	if (error?.digest) return error.digest
	const text = describeError(error).replace(/\s+/g, ' ').trim()
	return text ? text.slice(0, 120) : ''
}

export default function ErrorScreen({ error, source }: Props) {
	const [recovering, setRecovering] = useState(false)

	useEffect(() => {
		// Пишем в консоль до всего остального: если отправка отчёта не пройдёт,
		// у разработчика на устройстве останется хотя бы стек.
		console.error('[app] падение рендера', error)

		reportClientError(error, source, {
			digest: error?.digest,
			staleBundle: looksLikeStaleBundle(error),
		})

		// Сбой запуска (устаревший кеш, обрезанный ответ, чужая версия сборки)
		// лечится только перезагрузкой с чистым кешем — делаем это сразу, не
		// заставляя человека нажимать кнопку.
		if (isRecoverableStartupFailure(error) && recoverApp()) setRecovering(true)
	}, [error, source])

	const recover = (target?: string) => {
		setRecovering(true)
		void resetPwaCachesAndReload(target)
	}

	const code = errorCode(error)

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				minHeight: '100vh',
				background: '#0d0d0d',
				color: '#fff',
				fontFamily: 'system-ui, sans-serif',
				padding: 24,
				textAlign: 'center',
			}}
		>
			<div
				style={{
					width: 64, height: 64, borderRadius: 20,
					background: 'rgba(245, 197, 24, 0.1)',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					marginBottom: 20, fontSize: 28, color: '#f5c518', fontWeight: 700,
				}}
			>
				!
			</div>
			<h1 style={{ fontSize: 24, marginBottom: 8, fontWeight: 700 }}>
				{recovering ? 'Обновляем приложение' : 'Произошла ошибка'}
			</h1>
			<p style={{ color: '#888', marginBottom: 28, maxWidth: 360, fontSize: 14, lineHeight: 1.5 }}>
				{recovering
					? 'Загружаем свежую версию — это займёт несколько секунд.'
					: 'Нажмите «Обновить приложение»: мы очистим сохранённые файлы и загрузим свежую версию.'}
			</p>
			<button
				type="button"
				onClick={() => recover()}
				disabled={recovering}
				style={{
					padding: '12px 32px',
					borderRadius: 10,
					border: 'none',
					background: '#f5c518',
					color: '#000',
					fontSize: 15,
					fontWeight: 700,
					cursor: recovering ? 'default' : 'pointer',
					opacity: recovering ? 0.6 : 1,
					marginBottom: 12,
				}}
			>
				{recovering ? 'Обновляем…' : 'Обновить приложение'}
			</button>
			<a
				href="/login"
				onClick={event => {
					event.preventDefault()
					recover('/login')
				}}
				style={{ color: '#f5c518', fontSize: 13, textDecoration: 'none', marginTop: 4 }}
			>
				← На страницу входа
			</a>
			{code && (
				<p style={{ color: '#4a4a4a', fontSize: 11, marginTop: 24, maxWidth: 320, wordBreak: 'break-word' }}>
					Код ошибки: {code}
				</p>
			)}
		</div>
	)
}
