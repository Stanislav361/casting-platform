'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Processor } from '~widgets/processor/processor'
import { readTelegramStartCastingId } from '~/shared/telegram-start-param'
import { setPendingReturnUrl } from '~/shared/pending-return-url'
import { ensureAccessToken } from '~/shared/api-client'
import { ensureTelegramWebApp, getTelegramInitDataRaw, isTelegramLaunch } from '~/shared/telegram-sdk'
import { resetPwaCachesAndReload } from '~/shared/pwa-reset'

const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager', 'admin', 'admin_pro']
const ADMIN_REGISTRATION_PWA_KEY = 'pp_admin_registration_pwa'

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
			try {
				const url = new URL(window.location.href)
				isSuperAdminSource = url.searchParams.get('source') === 'pwa-admin'
				isGenericPwaLaunch = url.searchParams.get('source') === 'pwa'
			} catch {}

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
			} else {
				router.replace(castingTarget ? `/login?next=${encodeURIComponent(castingTarget)}` : '/login')
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
