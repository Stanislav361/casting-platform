'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
	useEffect(() => {
		if (process.env.NODE_ENV !== 'production') return
		if (!('serviceWorker' in navigator)) return
		if (!window.isSecureContext) return

		const register = async () => {
			try {
				await navigator.serviceWorker.register('/sw.js', { scope: '/' })
			} catch {
				// PWA should never break the app if service worker registration fails.
			}
		}

		if (typeof window.requestIdleCallback === 'function') {
			window.requestIdleCallback(register)
		} else {
			globalThis.setTimeout(register, 1200)
		}
	}, [])

	return null
}
