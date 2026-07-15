'use client'

import { useEffect } from 'react'

/**
 * Внутри Telegram Mini App без вызова ready()/expand() вьюпорт не
 * зафиксирован — это и создаёт эффект «гуляющего» приложения (свайпы
 * вбок/вниз двигают весь экран, потому что WebView считает страницу
 * обычной веб-страницей, а не встроенным приложением). Явно фиксируем
 * вьюпорт и отключаем свайпы, которые могут случайно закрыть/сдвинуть
 * приложение.
 */
export default function TelegramInit() {
	useEffect(() => {
		let attempts = 0
		let timer: ReturnType<typeof globalThis.setTimeout> | null = null

		const init = () => {
			const webApp = (window as any)?.Telegram?.WebApp
			if (!webApp) {
				// Скрипт telegram-web-app.js может подгрузиться чуть позже —
				// пробуем ещё несколько раз, но не бесконечно.
				attempts += 1
				if (attempts < 20) {
					timer = globalThis.setTimeout(init, 150)
				}
				return
			}

			try { webApp.ready?.() } catch { /* noop */ }
			try { webApp.expand?.() } catch { /* noop */ }
			try { webApp.disableVerticalSwipes?.() } catch { /* noop */ }
			try { webApp.setHeaderColor?.('#0b0b0f') } catch { /* noop */ }
			try { webApp.setBackgroundColor?.('#0b0b0f') } catch { /* noop */ }

			const lockViewport = () => {
				try {
					const height = webApp.viewportStableHeight || webApp.viewportHeight
					if (height) {
						document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`)
					}
				} catch { /* noop */ }
			}
			lockViewport()
			try { webApp.onEvent?.('viewportChanged', lockViewport) } catch { /* noop */ }
		}

		init()
		return () => {
			if (timer) globalThis.clearTimeout(timer)
		}
	}, [])

	return null
}
