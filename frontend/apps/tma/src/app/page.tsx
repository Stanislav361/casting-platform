'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Processor } from '~widgets/processor/processor'
import { readTelegramStartCastingId } from '~/shared/telegram-start-param'
import { setPendingReturnUrl } from '~/shared/pending-return-url'
import { ensureAccessToken } from '~/shared/api-client'
import { ensureTelegramWebApp, getTelegramInitDataRaw, isTelegramLaunch } from '~/shared/telegram-sdk'
import { resetPwaCachesAndReload } from '~/shared/pwa-reset'
import { isAdminRegistration, markAdminRegistration } from '~/shared/admin-registration'

const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager', 'admin', 'admin_pro']
const ADMIN_REGISTRATION_PWA_KEY = 'pp_admin_registration_pwa'
const ADMIN_LINK_VALUES = ['1', 'true', 'pro', 'solo', 'admin']

/**
 * Признак «попытка вернуться на запрошенный адрес уже была».
 *
 * Service worker при сбое сети отдаёт сохранённую оболочку приложения — документ
 * корневого адреса. В адресной строке при этом остаётся то, что человек
 * открывал, поэтому этот компонент может оказаться, например, на /login?admin=1.
 * Возврат на настоящий адрес пробуем один раз на вкладку: если переход не
 * удастся, Next.js уйдёт на полную перезагрузку страницы, и без этого признака
 * получился бы бесконечный круг «оболочка → переход → оболочка».
 */
const SHELL_RECOVERY_KEY = 'pp_shell_recovery'

const allowShellRecovery = (): boolean => {
	try {
		if (window.sessionStorage.getItem(SHELL_RECOVERY_KEY) === '1') return false
		window.sessionStorage.setItem(SHELL_RECOVERY_KEY, '1')
		return true
	} catch {
		return false
	}
}

/**
 * Через сколько предложить человеку выход, если старт так и не завершился.
 * Все запросы на этом пути ограничены таймаутами (самый долгий — обновление
 * токена, 15 секунд), поэтому берём заметно больше: иначе экран ошибки мигнёт
 * прямо перед нормальным переходом.
 */
const BOOT_TIMEOUT_MS = 25_000

const getRoleFromToken = (token: string): string => {
	try {
		const rawToken = token.includes(' ') ? token.split(' ').pop() : token
		return JSON.parse(atob(rawToken?.split('.')[1] || '')).role || 'user'
	} catch {
		return 'user'
	}
}

export default function HomePage() {
	const router = useRouter()
	const [showProcessor, setShowProcessor] = useState(false)
	const [pendingCastingTarget, setPendingCastingTarget] = useState<string | null>(null)
	const [bootStuck, setBootStuck] = useState(false)

	useEffect(() => {
		let cancelled = false

		const stuckTimer = globalThis.setTimeout(() => {
			if (!cancelled) setBootStuck(true)
		}, BOOT_TIMEOUT_MS)

		const route = async () => {
			let isSuperAdminSource = false
			let isGenericPwaLaunch = false
			let isAdminLink = false
			let requestedAddress = '/'
			let requestedPath = '/'
			try {
				const url = new URL(window.location.href)
				isSuperAdminSource = url.searchParams.get('source') === 'pwa-admin'
				isGenericPwaLaunch = url.searchParams.get('source') === 'pwa'
				isAdminLink = ADMIN_LINK_VALUES.includes((url.searchParams.get('admin') || '').toLowerCase())
				requestedPath = url.pathname
				requestedAddress = `${url.pathname}${url.search}`
			} catch {}

			// Адрес не корневой, а показывают нас — значит service worker отдал
			// оболочку приложения вместо запрошенной страницы. Молча продолжать
			// нельзя: ниже код увёл бы человека на общий /login, и ссылка для
			// регистрации администраторов (/login?admin=1) открыла бы регистрацию
			// актёра. Сначала запоминаем админскую ссылку, потом пробуем вернуться
			// на настоящий адрес.
			if (requestedPath !== '/') {
				if (isAdminLink) markAdminRegistration()
				if (allowShellRecovery()) {
					router.replace(requestedAddress)
					return
				}
			}

			if (isGenericPwaLaunch) {
				try {
					if (window.localStorage.getItem(ADMIN_REGISTRATION_PWA_KEY) === '1') {
						router.replace('/login?admin=1&source=pwa-admin-register')
						return
					}
				} catch {}
			}

			// Внутри Telegram SDK нужен только для авто-входа. Грузим его параллельно
			// с проверкой сессии, чтобы не удлинять старт, и ждём ответа лишь там,
			// где без данных запуска не обойтись.
			const telegramWebApp = isTelegramLaunch() ? ensureTelegramWebApp() : Promise.resolve(null)

			const castingId = readTelegramStartCastingId()
			const castingTarget = castingId ? `/cabinet/feed/${castingId}` : null
			const token = await ensureAccessToken()
			if (cancelled) return

			if (token) {
				const role = getRoleFromToken(token)
				if (isSuperAdminSource && role === 'owner') {
					router.replace('/dashboard/admin')
					return
				}
				if (isSuperAdminSource) {
					router.replace('/admin-login?source=pwa-admin')
					return
				}
				if (castingTarget && !ADMIN_ROLES.includes(role)) {
					router.replace(castingTarget)
					return
				}
				if (role === 'owner') {
					router.replace('/dashboard/admin')
					return
				}
				router.replace(ADMIN_ROLES.includes(role) ? '/dashboard' : '/actor-home')
				return
			}

			if (isSuperAdminSource) {
				router.replace('/admin-login?source=pwa-admin')
				return
			}

			if (castingTarget) {
				setPendingReturnUrl(castingTarget)
			}

			await telegramWebApp
			if (cancelled) return

			// Авто-вход возможен, только когда есть подписанные данные запуска.
			// Если SDK не поднялся, они ещё могут прийти из адреса страницы; и
			// если нет и там — уходим на обычный вход, а не висим на загрузке.
			const isTelegram = !!getTelegramInitDataRaw()

			if (isTelegram) {
				if (castingTarget) setPendingCastingTarget(castingTarget)
				setShowProcessor(true)
			} else if (castingTarget) {
				router.replace(`/login?next=${encodeURIComponent(castingTarget)}`)
			} else {
				// Человек, пришедший по ссылке для администраторов, должен попасть на
				// выбор «Админ / Админ PRO», даже если сам параметр адреса потерялся
				// (оболочка из кеша, запуск установленного приложения, возврат из
				// внешнего входа). См. shared/admin-registration.ts.
				router.replace(isAdminRegistration() ? '/login?admin=1' : '/login')
			}
		}

		route()
		return () => {
			cancelled = true
			globalThis.clearTimeout(stuckTimer)
		}
	}, [router])

	if (showProcessor) return <Processor returnUrl={pendingCastingTarget ?? undefined} />

	return (
		<div style={{
			display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh',
			alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
			background: '#0d0d0d', color: '#fff', textAlign: 'center'
		}}>
			{bootStuck ? (
				<>
					<p style={{ fontWeight: 600 }}>Приложение не отвечает</p>
					<p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, maxWidth: 320 }}>
						Похоже, сохранённая версия приложения повреждена. Обновите её — данные аккаунта сохранятся.
					</p>
					<button
						type='button'
						onClick={() => { void resetPwaCachesAndReload('/login') }}
						style={{
							padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
							background: '#f5c518', color: '#0d0d0d', fontWeight: 700, fontSize: 15
						}}
					>
						Обновить приложение
					</button>
				</>
			) : (
				<p>Загрузка...</p>
			)}
		</div>
	)
}
