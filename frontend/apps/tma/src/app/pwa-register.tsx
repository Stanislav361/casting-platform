'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '~/shared/api-client'
import { syncPushSubscription } from '~/shared/web-push'

export default function PwaRegister() {
	const router = useRouter()

	// Самовосстановление от «белого экрана» после деплоя: если закешированный
	// (через PWA / service worker) бандл ссылается на старые хэши чанков, которых
	// уже нет на сервере, браузер бросает ChunkLoadError и страница остаётся
	// пустой. В этом случае один раз перезагружаемся с обходом кеша, чтобы
	// подтянуть свежий HTML и чанки. Защита от циклов — через sessionStorage.
	useEffect(() => {
		const RELOAD_GUARD_KEY = 'chunk-reload-attempt'

		const looksLikeChunkError = (message: string): boolean => {
			const m = (message || '').toLowerCase()
			return (
				m.includes('chunkloaderror') ||
				m.includes('loading chunk') ||
				m.includes('loading css chunk') ||
				m.includes('failed to fetch dynamically imported module') ||
				m.includes('importing a module script failed')
			)
		}

		const recover = () => {
			try {
				if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
				sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
			} catch {
				// sessionStorage недоступен — всё равно пробуем перезагрузиться один раз
			}
			window.location.reload()
		}

		// Сброс защиты, если приложение успешно прогрузилось.
		const clearGuard = () => {
			try { sessionStorage.removeItem(RELOAD_GUARD_KEY) } catch { /* ignore */ }
		}
		const guardTimer = globalThis.setTimeout(clearGuard, 8000)

		const onError = (event: ErrorEvent) => {
			if (looksLikeChunkError(event.message) || looksLikeChunkError(String(event.error?.name || ''))) {
				recover()
			}
		}
		const onRejection = (event: PromiseRejectionEvent) => {
			const reason = event.reason
			const text = typeof reason === 'string' ? reason : `${reason?.name || ''} ${reason?.message || ''}`
			if (looksLikeChunkError(text)) recover()
		}

		window.addEventListener('error', onError)
		window.addEventListener('unhandledrejection', onRejection)
		return () => {
			globalThis.clearTimeout(guardTimer)
			window.removeEventListener('error', onError)
			window.removeEventListener('unhandledrejection', onRejection)
		}
	}, [])

	useEffect(() => {
		if (process.env.NODE_ENV !== 'production') return
		if (!('serviceWorker' in navigator)) return
		if (!window.isSecureContext) return

		const syncPushSafely = async () => {
			if (!getToken()) return
			if (!('Notification' in window)) return
			if (Notification.permission !== 'granted') return
			await syncPushSubscription()
		}

		const register = async () => {
			try {
				const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
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
