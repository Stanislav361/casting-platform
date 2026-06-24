import { apiCall, getToken } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'

const SUPPRESS_KEY = 'pp_push_prompt_suppressed_until'

export type PushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'
export type PushSupportIssue =
	| 'server'
	| 'not-secure-context'
	| 'no-service-worker'
	| 'no-push-manager'
	| 'no-notification-api'
	| 'denied'
	| null

export function isPushSupported(): boolean {
	if (typeof window === 'undefined') return false
	if (!('serviceWorker' in navigator)) return false
	if (!('PushManager' in window)) return false
	if (!('Notification' in window)) return false
	if (!window.isSecureContext) return false
	return true
}

export function isStandalonePwa(): boolean {
	if (typeof window === 'undefined') return false
	const navigatorStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
	const displayStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true
	return navigatorStandalone || displayStandalone
}

export function getPushSupportIssue(): PushSupportIssue {
	if (typeof window === 'undefined') return 'server'
	if (!window.isSecureContext) return 'not-secure-context'
	if (!('serviceWorker' in navigator)) return 'no-service-worker'
	if (!('PushManager' in window)) return 'no-push-manager'
	if (!('Notification' in window)) return 'no-notification-api'
	if (Notification.permission === 'denied') return 'denied'
	return null
}

export type PushPlatform = 'ios' | 'android' | 'other'

export function getPushPlatform(): PushPlatform {
	if (typeof navigator === 'undefined') return 'other'
	const ua = navigator.userAgent || ''
	const isIpadOs = ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document
	if (/iPad|iPhone|iPod/.test(ua) || isIpadOs) return 'ios'
	if (/Android/i.test(ua)) return 'android'
	return 'other'
}

const PICK_OTHER_CHANNEL = 'Либо выберите уведомления «На email» или «В приложении» ниже.'

export function getPushIssueMessage(issue: PushSupportIssue): string | null {
	if (!issue) return null
	const platform = getPushPlatform()
	if (issue === 'not-secure-context') return 'Уведомления работают только на защищённом HTTPS-сайте.'
	if (issue === 'no-service-worker') {
		return `Этот браузер не поддерживает фоновые уведомления. ${PICK_OTHER_CHANNEL}`
	}
	if (issue === 'no-push-manager') {
		if (platform === 'ios') {
			return 'На iPhone push-уведомления работают, только если добавить сайт на экран «Домой» (Safari → Поделиться → На экран «Домой»). ' + PICK_OTHER_CHANNEL
		}
		return `Этот браузер не поддерживает push. Откройте сайт в Chrome. ${PICK_OTHER_CHANNEL}`
	}
	if (issue === 'no-notification-api') return `Ваш браузер не поддерживает системные уведомления. ${PICK_OTHER_CHANNEL}`
	if (issue === 'denied') {
		if (platform === 'ios') {
			return 'Уведомления запрещены. Включите их в Настройках iPhone для этого сайта/приложения. ' + PICK_OTHER_CHANNEL
		}
		if (platform === 'android') {
			return 'Уведомления запрещены. Включите их в настройках браузера (значок 🔒 в адресной строке → Уведомления). ' + PICK_OTHER_CHANNEL
		}
		return `Уведомления запрещены в браузере. Включите их в настройках сайта. ${PICK_OTHER_CHANNEL}`
	}
	return 'Уведомления временно недоступны.'
}

export function getPushPermission(): PushPermissionState {
	if (!isPushSupported()) return 'unsupported'
	return Notification.permission as PushPermissionState
}

export function shouldShowPrompt(): boolean {
	if (!isPushSupported()) return false
	if (Notification.permission === 'denied') return false
	try {
		const until = Number(localStorage.getItem(SUPPRESS_KEY) || '0')
		if (until && Date.now() < until) return false
	} catch {
		// ignore storage errors
	}
	return true
}

export async function hasPushSubscription(): Promise<boolean> {
	if (!isPushSupported()) return false
	if (Notification.permission !== 'granted') return false
	const reg = await getServiceWorker()
	if (!reg) return false
	const sub = await reg.pushManager.getSubscription()
	return Boolean(sub)
}

export function suppressPromptFor(daysMs = 1000 * 60 * 60 * 24 * 14): void {
	try {
		localStorage.setItem(SUPPRESS_KEY, String(Date.now() + daysMs))
	} catch {
		// ignore
	}
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4)
	const safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
	const raw = atob(safe)
	const out = new Uint8Array(raw.length)
	for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
	return out
}

async function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (!('serviceWorker' in navigator)) return null
	try {
		const reg = await navigator.serviceWorker.ready
		return reg || null
	} catch {
		return null
	}
}

async function fetchVapidKey(): Promise<string | null> {
	try {
		const res = await fetch(`${API_URL}push/vapid-key/`, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
			cache: 'no-store',
		})
		if (!res.ok) return null
		const data = await res.json().catch(() => null)
		if (!data?.public_key) return null
		return data.public_key as string
	} catch {
		return null
	}
}

function pickKey(sub: PushSubscription, key: 'p256dh' | 'auth'): string {
	const buffer = sub.getKey(key)
	if (!buffer) return ''
	const bytes = new Uint8Array(buffer)
	let bin = ''
	for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!)
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
	const supportIssue = getPushSupportIssue()
	if (supportIssue) return { ok: false, reason: supportIssue }
	if (Notification.permission === 'denied') return { ok: false, reason: 'denied' }

	// iOS/Safari require the permission prompt to happen directly from a user gesture.
	// Keep this before any awaited SW/network work so the click activation is not lost.
	if (Notification.permission === 'default') {
		const result = await Notification.requestPermission()
		if (result !== 'granted') return { ok: false, reason: 'permission-denied' }
	}

	const reg = await getServiceWorker()
	if (!reg) return { ok: false, reason: 'no-sw' }

	const vapid = await fetchVapidKey()
	if (!vapid) return { ok: false, reason: 'no-vapid' }

	let sub = await reg.pushManager.getSubscription()
	if (!sub) {
		try {
			sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapid),
			})
		} catch (err) {
			return { ok: false, reason: (err as Error)?.message || 'subscribe-failed' }
		}
	}

	const res = await apiCall('POST', 'push/subscribe/', {
		endpoint: sub.endpoint,
		keys: {
			p256dh: pickKey(sub, 'p256dh'),
			auth: pickKey(sub, 'auth'),
		},
	})
	if (!res || res.detail) {
		return { ok: false, reason: res?.detail || 'server-error' }
	}
	return { ok: true }
}

export async function unsubscribeFromPush(): Promise<void> {
	const reg = await getServiceWorker()
	if (!reg) return
	const sub = await reg.pushManager.getSubscription()
	if (!sub) return
	try {
		await apiCall('POST', 'push/unsubscribe/', { endpoint: sub.endpoint })
	} catch {
		// ignore network errors
	}
	try {
		await sub.unsubscribe()
	} catch {
		// ignore
	}
}

export async function syncPushSubscription(): Promise<void> {
	if (!isPushSupported()) return
	if (Notification.permission !== 'granted') return
	if (!getToken()) return
	await subscribeToPush()
}
