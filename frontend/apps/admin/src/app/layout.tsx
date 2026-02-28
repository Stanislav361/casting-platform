import type { Metadata } from 'next'
import { Noto_Sans } from 'next/font/google'
import Head from 'next/head'
import type { ReactNode } from 'react'

import WithProviders from '~packages/providers'
import { Root } from '~packages/ui'

import './globals.scss'

const notoSans = Noto_Sans({
	variable: '--font-noto-sans',
	style: 'normal',
	weight: '400',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	title: 'prostoprobuy',
	description: 'admin panel for prostoprobuy project',
	robots: 'noindex, nofollow',
	openGraph: {
		title: 'prostoprobuy',
		description: 'admin panel for prostoprobuy project',
		type: 'website',
	},
	twitter: {
		title: 'prostoprobuy',
		description: 'admin panel for prostoprobuy project',
	},
}

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode
}>) {
	return (
		<html lang='ru' suppressHydrationWarning className={notoSans.variable}>
			<Head>
				<link rel='icon' href='/public/favicon.ico' />
				<link
					rel='apple-touch-icon'
					sizes='180x180'
					href='/public/favicon.ico'
				/>
				<link
					rel='shortcut icon'
					href='/public/favicon.ico'
					type='image/png'
				/>
			</Head>
			<body className={notoSans.variable}>
				<WithProviders>
					<Root>{children}</Root>
				</WithProviders>
			</body>
		</html>
	)
}
