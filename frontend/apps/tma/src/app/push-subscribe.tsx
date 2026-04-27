'use client'

import { useEffect } from 'react'
import { apiCall } from '~/shared/api-client'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
	const raw = window.atob(base64)
	return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function subscribeToPush(): Promise<void> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
	if (!window.isSecureContext) return

	// Check if user already granted or denied
	const currentPerm = Notification.permission
	if (currentPerm === 'denied') return

	// Fetch VAPID public key from backend
	const vapidData = await apiCall('GET', 'notifications/push/vapid-public-key/')
	if (!vapidData?.vapid_public_key) return

	const registration = await navigator.serviceWorker.ready

	// Check if already subscribed
	const existing = await registration.pushManager.getSubscription()
	if (existing) {
		// Re-register to ensure backend has it
		const json = existing.toJSON()
		await apiCall('POST', 'notifications/push/subscribe/', {
			endpoint: existing.endpoint,
			p256dh: json.keys?.p256dh ?? '',
			auth: json.keys?.auth ?? '',
		})
		return
	}

	// Request permission
	const permission = await Notification.requestPermission()
	if (permission !== 'granted') return

	// Subscribe
	const sub = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapidData.vapid_public_key),
	})

	const json = sub.toJSON()
	await apiCall('POST', 'notifications/push/subscribe/', {
		endpoint: sub.endpoint,
		p256dh: json.keys?.p256dh ?? '',
		auth: json.keys?.auth ?? '',
	})
}

export default function PushSubscribe() {
	useEffect(() => {
		// Only run if service worker is registered and we have a token
		const token = typeof window !== 'undefined'
			? localStorage.getItem('user_token') || sessionStorage.getItem('user_token')
			: null

		if (!token) return

		// Delay to not block initial render
		const timer = setTimeout(() => {
			subscribeToPush().catch(() => {
				// Push subscription should never break the app
			})
		}, 3000)

		return () => clearTimeout(timer)
	}, [])

	return null
}
