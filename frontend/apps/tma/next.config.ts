import type { NextConfig } from 'next'

// Content-Security-Policy.
//
// script-src намеренно оставлен с 'unsafe-inline': Next.js встраивает в страницу
// инлайновые скрипты гидратации, и убрать их можно только через nonce, а nonce
// требует уникального заголовка на каждый запрос — это отключает статическую
// пререндер-выдачу и заметно бьёт по скорости живого приложения. Основную защиту
// от XSS даёт устранение самого стока (см. packages/ui/formatted), а CSP здесь
// закрывает остальные векторы: подмену base-адреса, отправку форм на чужой домен,
// внедрение object/embed и загрузку страницы в чужой iframe.
//
// frame-ancestors вместо X-Frame-Options: DENY — приложение является Telegram
// Mini App и в Telegram Web открывается внутри iframe с web.telegram.org.
// Жёсткий DENY сломал бы вход через Telegram, а X-Frame-Options не умеет
// перечислять несколько доверенных источников.
const contentSecurityPolicy = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"form-action 'self'",
	"frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
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
		// Только HTTPS в течение двух лет, включая поддомены.
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains; preload',
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
		// Приложение не использует камеру, микрофон, геолокацию и платёжный API —
		// отзываем эти разрешения, чтобы ими не воспользовался внедрённый код.
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
	output: 'standalone',
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
