'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '~/shared/api-client'
import { isTelegramEmbedded } from '~/shared/telegram-sdk'
import { looksLikeStaleBundle, recoverApp } from '~/shared/app-recovery'
import { reportClientError } from '~/shared/report-client-error'
import { syncPushSubscription } from '~/shared/web-push'

function buildTag(): string {
	try {
		const data = (globalThis as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__
		return data?.buildId || 'nobuild'
	} catch {
		return 'nobuild'
	}
}

export default function PwaRegister() {
	const router = useRouter()

	// Самовосстановление от «белого экрана» после деплоя: если закешированный
	// (через PWA / service worker) бандл ссылается на старые хэши чанков, которых
	// уже нет на сервере, браузер бросает ChunkLoadError и страница остаётся
	// пустой. В этом случае один раз выбрасываем кеш PWA и открываем приложение
	// заново (см. shared/app-recovery). Здесь ловим только ошибки, дошедшие до
	// window; падения рендера перехватывают границы ошибок React — они лечат себя
	// тем же способом (см. app/error-screen.tsx).
	useEffect(() => {
		const handle = (error: unknown) => {
			if (!looksLikeStaleBundle(error)) return
			const recovered = recoverApp()
			reportClientError(error, 'window', { staleBundle: true, recovered })
		}

		const onError = (event: ErrorEvent) => handle(event.error || event.message)
		const onRejection = (event: PromiseRejectionEvent) => handle(event.reason)

		window.addEventListener('error', onError)
		window.addEventListener('unhandledrejection', onRejection)
		return () => {
			window.removeEventListener('error', onError)
			window.removeEventListener('unhandledrejection', onRejection)
		}
	}, [])

	useEffect(() => {
		if (process.env.NODE_ENV !== 'production') return
		if (!('serviceWorker' in navigator)) return
		if (!window.isSecureContext) return

		// Telegram Android открывает ссылку из канала во встроенном WebView.
		// Service worker PWA там перехватывает навигацию и отдаёт оболочку
		// корня — человек видит чёрный экран вместо кастинга. Во Mini App и
		// во встроенном браузере PWA не нужен: это не установленное приложение.
		if (isTelegramEmbedded()) {
			navigator.serviceWorker.getRegistrations().then(registrations => {
				registrations.forEach(registration => {
					void registration.unregister()
				})
			}).catch(() => {
				// снятие worker'а не должно ломать открытие кастинга
			})
			return
		}

		const syncPushSafely = async () => {
			if (!getToken()) return
			if (!('Notification' in window)) return
			if (Notification.permission !== 'granted') return
			await syncPushSubscription()
		}

		const register = async () => {
			try {
				const registration = await navigator.serviceWorker.register(
					`/sw.js?v=${buildTag()}`,
					{ scope: '/' },
				)
				registration.update().catch(() => {
					// best-effort update check
				})
				try {
					await syncPushSafely()
				} catch {
					// best-effort
				}
			} catch {
				// PWA should never break the app if service worker registration fails.
			}
		}

		let refreshing = false
		const onControllerChange = () => {
			if (refreshing) return
			refreshing = true
			window.location.reload()
		}

		if (typeof window.requestIdleCallback === 'function') {
			window.requestIdleCallback(register)
		} else {
			globalThis.setTimeout(register, 1200)
		}

		const onMessage = (event: MessageEvent) => {
			const data = event.data
			if (!data || typeof data !== 'object') return
			if (data.type === 'NAVIGATE' && typeof data.url === 'string') {
				router.push(data.url)
			}
			if (data.type === 'PUSH_SUBSCRIPTION_CHANGE') {
				syncPushSafely().catch(() => {
					// ignore
				})
			}
		}

		navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
		navigator.serviceWorker.addEventListener('message', onMessage)
		return () => {
			navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
			navigator.serviceWorker.removeEventListener('message', onMessage)
		}
	}, [router])

	return null
}
