import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	compress: true,
	reactStrictMode: true,
	generateEtags: true,
	skipMiddlewareUrlNormalize: true,
	poweredByHeader: false,
	productionBrowserSourceMaps: false,
	crossOrigin: 'use-credentials',
	typescript: {
		ignoreBuildErrors: true,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	env: {
		API_URL: process.env.API_URL,
		TELEGRAM_CHANNEL: process.env.TELEGRAM_CHANNEL,
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 't.me',
			},
			{
				protocol: 'https',
				hostname: '*.prostoprobuy-dev.ru',
			},
			{
				protocol: 'https',
				hostname: '*.prostoprobuy-prod.ru',
			},
			{
				protocol: 'https',
				hostname: '*.selstorage.ru',
			},
		],
	},
}

export default nextConfig
