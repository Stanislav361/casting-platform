import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function middleware(req: NextRequest) {
	const { pathname, searchParams } = req.nextUrl

	// Отдельная PWA-ссылка супер-админа иногда открывается установленным
	// приложением через общий start_url. Если source=pwa-admin попал на корень
	// или общий логин — жёстко ведём на SuperAdmin, до загрузки React.
	if ((pathname === '/' || pathname === '/login') && searchParams.get('source') === 'pwa-admin') {
		const url = req.nextUrl.clone()
		url.pathname = '/admin-login'
		url.search = '?source=pwa-admin'
		return NextResponse.redirect(url)
	}

	return NextResponse.next()
}

export const config = { matcher: '/((?!.*\\.).*)' }
