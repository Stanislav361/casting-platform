import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { CastingProvider } from '~models/casting'

import WithProviders from '~packages/providers'
import { ToasterProvider } from '~packages/providers/toaster'
import SplashScreen from '~packages/providers/splash-screen'
import AppShell from '~/widgets/app-nav/app-shell'
import PwaRegister from './pwa-register'
import PushPrompt from '~/widgets/push-prompt/push-prompt'

import './globals.scss'
import '@telegram-apps/telegram-ui/dist/styles.css'

export const metadata: Metadata = {
	title: 'prostoprobuy',
	description: 'Платформа кастингов, проектов, актёров и отчётов',
	applicationName: 'prostoprobuy',
	manifest: '/manifest.webmanifest',
	robots: 'noindex, nofollow',
	appleWebApp: {
		capable: true,
		title: 'prostoprobuy',
		statusBarStyle: 'black-translucent',
		startupImage: [
			{
				url: '/pwa/splash-1170x2532.png',
				media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
			},
			{
				url: '/pwa/splash-1290x2796.png',
				media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
			},
			{
				url: '/pwa/splash-1125x2436.png',
				media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
			},
			{
				url: '/pwa/splash-828x1792.png',
				media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
			},
			{
				url: '/pwa/splash-1242x2688.png',
				media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)',
			},
		],
	},
	icons: {
		icon: [
			{ url: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ url: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
		],
		apple: [
			{ url: '/pwa/icon-180.png', sizes: '180x180', type: 'image/png' },
		],
	},
	openGraph: {
		title: 'prostoprobuy',
		description: 'Платформа кастингов, проектов, актёров и отчётов',
		type: 'website',
	},
	twitter: {
		title: 'prostoprobuy',
		description: 'Платформа кастингов, проектов, актёров и отчётов',
	},
	other: {
		'mobile-web-app-capable': 'yes',
		'apple-mobile-web-app-capable': 'yes',
		'apple-mobile-web-app-title': 'prostoprobuy',
		'apple-mobile-web-app-status-bar-style': 'black-translucent',
		'format-detection': 'telephone=no',
	},
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: 'cover',
	themeColor: '#0b0b0f',
	colorScheme: 'dark',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode
}>) {
	return (
		<html lang='ru' suppressHydrationWarning>
			<body>
				<PwaRegister />
				<SplashScreen />
				<WithProviders>
					<CastingProvider>
						<AppShell>
							{children}
						</AppShell>
						<ToasterProvider />
						<PushPrompt />
					</CastingProvider>
				</WithProviders>
			</body>
		</html>
	)
}
