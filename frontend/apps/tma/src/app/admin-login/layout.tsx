import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Отдельные метаданные для маршрута /admin-login: при добавлении ссылки
// на экран «Домой» иконка подписывается «SuperAdmin» и открывается в
// полноэкранном (standalone) режиме, как отдельное приложение.
export const metadata: Metadata = {
	title: 'SuperAdmin',
	applicationName: 'SuperAdmin',
	// Отдельный манифест со start_url=/admin-login: при запуске с экрана «Домой»
	// открывается именно вход супер-админа, а не общий старт приложения.
	manifest: '/admin-manifest.webmanifest',
	appleWebApp: {
		capable: true,
		title: 'SuperAdmin',
		statusBarStyle: 'black-translucent',
	},
	other: {
		'mobile-web-app-capable': 'yes',
		'apple-mobile-web-app-capable': 'yes',
		'apple-mobile-web-app-title': 'SuperAdmin',
	},
}

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
	return children
}
