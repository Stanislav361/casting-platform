/**
 * Доступ к Telegram Mini App SDK без блокировки старта приложения.
 *
 * Раньше `telegram-web-app.js` подключался в layout через
 * `<Script strategy='beforeInteractive'>`. В App Router такие скрипты попадают
 * в `self.__next_s`, а загрузчик Next ждёт их `onload`/`onerror` ПЕРЕД
 * гидратацией. Домен telegram.org в России часто не отвечает вовсе (соединение
 * не закрывается, а молча висит) — тогда ни одно из событий не наступает,
 * гидратация не начинается, и на экране навсегда остаётся серверный сплэш:
 * «ЗАГРУЗКА», которая никогда не заканчивается.
 *
 * Поэтому SDK грузится здесь: только когда приложение реально открыто внутри
 * Telegram, асинхронно и с таймаутом. Обычный браузер за скриптом вообще не
 * ходит, а внутри Telegram отказ SDK деградирует до входа через OAuth.
 */

export interface TelegramWebApp {
	initData?: string
	initDataUnsafe?: { start_param?: string; [key: string]: unknown }
	ready?: () => void
	expand?: () => void
	disableVerticalSwipes?: () => void
	setHeaderColor?: (color: string) => void
	setBackgroundColor?: (color: string) => void
	viewportHeight?: number
	viewportStableHeight?: number
	onEvent?: (event: string, handler: () => void) => void
}

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'

/**
 * Сколько ждём SDK. Внутри Telegram скрипт приходит из своего же окружения за
 * десятки миллисекунд, так что запас большой; дольше держать человека на
 * загрузочном экране нельзя — лучше показать обычный вход.
 */
const SDK_TIMEOUT_MS = 4000

/**
 * Признак запуска из Telegram живёт в адресе (`#tgWebAppData=...`), а первый же
 * переход по приложению этот адрес затирает. Запоминаем факт запуска на время
 * сессии вкладки, чтобы SDK оставался доступен и после навигации.
 */
const LAUNCH_FLAG_KEY = 'pp_tg_launch'

const TELEGRAM_URL_MARKERS = ['tgWebAppData', 'tgWebAppPlatform', 'tgWebAppVersion']

let sdkPromise: Promise<TelegramWebApp | null> | null = null

function getWebApp(): TelegramWebApp | null {
	if (typeof window === 'undefined') return null
	try {
		return (window as any)?.Telegram?.WebApp || null
	} catch {
		// Кастомные клиенты Telegram иногда бросают на обращении к объекту.
		return null
	}
}

/** Параметры запуска Mini App: Telegram кладёт их в hash, реже — в query. */
function readLaunchParams(): URLSearchParams | null {
	if (typeof window === 'undefined') return null
	try {
		const hash = window.location.hash || ''
		const hashQuery = hash.includes('?')
			? hash.slice(hash.indexOf('?') + 1)
			: hash.replace(/^#/, '')
		if (hashQuery) {
			const params = new URLSearchParams(hashQuery)
			if (TELEGRAM_URL_MARKERS.some(marker => params.has(marker))) return params
		}
	} catch {
		// Некорректный hash — не повод падать.
	}
	try {
		const params = new URL(window.location.href).searchParams
		if (TELEGRAM_URL_MARKERS.some(marker => params.has(marker))) return params
	} catch {
		// noop
	}
	return null
}

function rememberTelegramLaunch(): void {
	try {
		window.sessionStorage.setItem(LAUNCH_FLAG_KEY, '1')
	} catch {
		// Приватный режим без sessionStorage — обойдёмся адресом страницы.
	}
}

function wasTelegramLaunch(): boolean {
	try {
		return window.sessionStorage.getItem(LAUNCH_FLAG_KEY) === '1'
	} catch {
		return false
	}
}

/**
 * Открыто ли приложение внутри Telegram. Проверка синхронная и без сети:
 * решает, идти ли вообще за SDK.
 */
export function isTelegramLaunch(): boolean {
	if (typeof window === 'undefined') return false

	if (getWebApp()?.initData) {
		rememberTelegramLaunch()
		return true
	}
	if (readLaunchParams()) {
		rememberTelegramLaunch()
		return true
	}
	// JS-мост, который Telegram внедряет в WebView Mini App.
	const w = window as any
	if (w.TelegramWebviewProxy || w.TelegramWebviewProxyProto) {
		rememberTelegramLaunch()
		return true
	}
	return wasTelegramLaunch()
}

/**
 * Подписанные данные запуска для авторизации на бэкенде. Берём из SDK, а если
 * он не поднялся — из адреса страницы: Telegram кладёт туда ту же строку, что
 * потом отдаёт в `WebApp.initData`, поэтому вход работает и без SDK.
 */
export function getTelegramInitDataRaw(): string {
	const fromSdk = getWebApp()?.initData
	if (typeof fromSdk === 'string' && fromSdk.length > 0) return fromSdk

	const params = readLaunchParams()
	const fromUrl = params?.get('tgWebAppData')
	return typeof fromUrl === 'string' && fromUrl.length > 0 ? fromUrl : ''
}

/**
 * Дождаться SDK: вернуть `WebApp`, либо `null`, если приложение открыто не в
 * Telegram или скрипт не успел/не смог загрузиться. Никогда не висит дольше
 * `timeoutMs` и никогда не бросает.
 */
export function ensureTelegramWebApp(timeoutMs = SDK_TIMEOUT_MS): Promise<TelegramWebApp | null> {
	if (typeof window === 'undefined') return Promise.resolve(null)

	const existing = getWebApp()
	if (existing) return Promise.resolve(existing)

	// Обычный браузер: за скриптом не идём совсем — это и есть защита от
	// зависания на недоступном telegram.org.
	if (!isTelegramLaunch()) return Promise.resolve(null)

	if (!sdkPromise) {
		sdkPromise = new Promise<TelegramWebApp | null>(resolve => {
			let settled = false
			const finish = () => {
				if (settled) return
				settled = true
				globalThis.clearTimeout(timer)
				resolve(getWebApp())
			}

			// Таймаут обязателен: заблокированный домен не даёт ни onload, ни
			// onerror — запрос просто висит.
			const timer = globalThis.setTimeout(() => {
				// Промис не кешируем навсегда: следующая попытка (например, после
				// перехода внутри приложения) может успеть.
				sdkPromise = null
				finish()
			}, timeoutMs)

			try {
				const script = document.createElement('script')
				script.src = SDK_URL
				script.async = true
				script.onload = finish
				script.onerror = () => {
					sdkPromise = null
					finish()
				}
				document.head.appendChild(script)
			} catch {
				sdkPromise = null
				finish()
			}
		})
	}

	return sdkPromise
}
