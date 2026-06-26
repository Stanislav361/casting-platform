import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_REGISTRATION_PWA_KEY = 'pp_admin_registration_pwa'
const ADMIN_LINK_VALUES = ['1', 'true', 'pro', 'solo', 'admin']

export default function middleware(req: NextRequest) {
	const { pathname, searchParams } = req.nextUrl
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
		response.cookies.set(ADMIN_REGISTRATION_PWA_KEY, '1', {
			path: '/',
			maxAge: 365 * 24 * 60 * 60,
			sameSite: 'lax',
		})
	}

	return response
}

export const config = { matcher: '/((?!.*\\.).*)' }
