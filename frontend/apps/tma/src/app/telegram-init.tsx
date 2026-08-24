'use client'

import { useEffect } from 'react'
import { ensureTelegramWebApp } from '~/shared/telegram-sdk'

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
		let cancelled = false

		// В обычном браузере вернётся null сразу и без сетевых запросов, внутри
		// Telegram — объект WebApp или null по таймауту загрузки SDK.
		ensureTelegramWebApp().then(webApp => {
			if (cancelled || !webApp) return

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
		})

		return () => { cancelled = true }
	}, [])

	return null
}
