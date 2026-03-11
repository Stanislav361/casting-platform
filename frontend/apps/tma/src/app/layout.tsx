import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { CastingProvider } from '~models/casting'

import WithProviders from '~packages/providers'

import './globals.scss'
import '@telegram-apps/telegram-ui/dist/styles.css'

export const metadata: Metadata = {
	title: 'prostoprobuy',
	description: 'telegram mini app - prostoprobuy',
	robots: 'noindex, nofollow',
	openGraph: {
		title: 'prostoprobuy',
		description: 'telegram mini app - prostoprobuy',
		type: 'website',
	},
	twitter: {
		title: 'prostoprobuy',
		description: 'telegram mini app - prostoprobuy',
	},
}

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode
}>) {
	return (
		<html lang='ru' suppressHydrationWarning>
			<body>
				<WithProviders>
					<CastingProvider>{children}</CastingProvider>
				</WithProviders>
			</body>
		</html>
	)
}
