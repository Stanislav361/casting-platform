'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '~/shared/api-client'
import { syncPushSubscription } from '~/shared/web-push'

export default function PwaRegister() {
	const router = useRouter()

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
				await navigator.serviceWorker.register('/sw.js', { scope: '/' })
				try {
					await syncPushSafely()
				} catch {
					// best-effort
				}
			} catch {
				// PWA should never break the app if service worker registration fails.
			}
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

		navigator.serviceWorker.addEventListener('message', onMessage)
		return () => navigator.serviceWorker.removeEventListener('message', onMessage)
	}, [router])

	return null
}
