import type { NextConfig } from 'next'

// Админ-панель не является Telegram Mini App и не должна открываться в чужом
// iframe ни при каких условиях — поэтому здесь frame-ancestors 'none' и
// дублирующий X-Frame-Options: DENY для старых браузеров.
//
// frame-src разрешён для oauth.telegram.org: виджет входа через Telegram
// встраивается в нашу страницу как iframe.
const contentSecurityPolicy = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	"frame-src 'self' https://oauth.telegram.org https://*.telegram.org",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"media-src 'self' data: blob: https:",
	"font-src 'self' data:",
	"connect-src 'self' https: wss:",
	"worker-src 'self' blob:",
	"manifest-src 'self'",
	'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
	{
		key: 'Content-Security-Policy',
		value: contentSecurityPolicy,
	},
	{
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains; preload',
	},
	{
		key: 'X-Frame-Options',
		value: 'DENY',
	},
	{
		key: 'X-Content-Type-Options',
		value: 'nosniff',
	},
	{
		key: 'Referrer-Policy',
		value: 'strict-origin-when-cross-origin',
	},
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	},
	{
		key: 'X-DNS-Prefetch-Control',
		value: 'off',
	},
	{
		key: 'Cross-Origin-Opener-Policy',
		value: 'same-origin-allow-popups',
	},
]

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
		TELEGRAM_AUTH_BOT: process.env.TELEGRAM_AUTH_BOT,
		TELEGRAM_AUTH_BOT_ID: process.env.TELEGRAM_AUTH_BOT_ID,
	},
	async headers() {
		return [
			{
				source: '/:path*',
				headers: securityHeaders,
			},
		]
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
