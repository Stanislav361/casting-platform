import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_REGISTRATION_PWA_KEY = 'pp_admin_registration_pwa'
// Признак админской регистрации нужен и на следующих шагах входа, где `admin=1`
// в адресе уже нет: см. shared/admin-registration.ts.
const ADMIN_REGISTRATION_KEY = 'pp_admin_registration'
const ADMIN_LINK_VALUES = ['1', 'true', 'pro', 'solo', 'admin']

// Бэкенд, куда уходят запросы с /api/ этого же домена.
const API_PROXY_TARGET = (
	process.env.API_PROXY_TARGET ||
	'https://casting-platform-production.up.railway.app'
).replace(/\/+$/, '')

export default function middleware(req: NextRequest) {
	const { pathname, searchParams } = req.nextUrl

	// API вынесен в отдельный сервис, но клиент обращается к нему по адресу
	// текущего домена (NEXT_PUBLIC_API_URL = https://<домен>/api/), чтобы
	// запросы оставались same-origin и браузер не ходил на второй домен.
	//
	// Проксируем здесь, а не через rewrites() в next.config: адреса API
	// заканчиваются слешем (/employer/actors/all/), а в rewrites подстановка
	// `:path*` этот слеш срезает — бэкенд отвечал бы редиректом на собственный
	// домен вместо самих данных. В middleware путь передаётся как есть
	// (см. skipMiddlewareUrlNormalize в next.config).
	if (pathname.startsWith('/api/')) {
		const target = new URL(
			`${API_PROXY_TARGET}${pathname.slice('/api'.length)}${req.nextUrl.search}`,
		)
		return NextResponse.rewrite(target)
	}

	const isAdminRegistrationLink =
		pathname === '/login' &&
		ADMIN_LINK_VALUES.includes((searchParams.get('admin') || '').toLowerCase())

	// Отдельная PWA-ссылка супер-админа иногда открывается установленным
	// приложением через общий start_url. Если source=pwa-admin попал на корень
	// или общий логин — жёстко ведём на SuperAdmin, до загрузки React.
	if ((pathname === '/' || pathname === '/login') && searchParams.get('source') === 'pwa-admin') {
		const url = req.nextUrl.clone()
		url.pathname = '/admin-login'
		url.search = '?source=pwa-admin'
		return NextResponse.redirect(url)
	}

	// iOS при добавлении /login?admin=1 на экран "Домой" может запустить общий
	// manifest.start_url (/?source=pwa) и потерять query admin=1. Запоминаем, что
	// именно эта PWA-иконка создавалась с админской ссылки, и возвращаем её назад.
	if ((pathname === '/' || pathname === '/login') && searchParams.get('source') === 'pwa') {
		const isAdminRegistrationPwa = req.cookies.get(ADMIN_REGISTRATION_PWA_KEY)?.value === '1'
		if (isAdminRegistrationPwa) {
			const url = req.nextUrl.clone()
			url.pathname = '/login'
			url.search = '?admin=1&source=pwa-admin-register'
			return NextResponse.redirect(url)
		}
	}

	const response = NextResponse.next()

	if (isAdminRegistrationLink) {
		for (const key of [ADMIN_REGISTRATION_PWA_KEY, ADMIN_REGISTRATION_KEY]) {
			response.cookies.set(key, '1', {
				path: '/',
				maxAge: 365 * 24 * 60 * 60,
				sameSite: 'lax',
			})
		}
	}

	return response
}

// Общий matcher намеренно пропускает адреса с точкой (файлы), поэтому /api/
// перечислен отдельно: под ним встречаются и запросы к файлам вида
// /api/uploads/photo.jpg, а они тоже должны уходить на бэкенд.
export const config = { matcher: ['/api/:path*', '/((?!.*\\.).*)'] }
