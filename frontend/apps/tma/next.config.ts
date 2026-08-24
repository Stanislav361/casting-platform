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

// Бэкенд, куда уходят запросы с этого же домена (см. rewrites ниже).
// Полный адрес без завершающего слеша, например https://api.example.com.
const apiProxyTarget = (
	process.env.API_PROXY_TARGET ||
	'https://casting-platform-production.up.railway.app'
).replace(/\/+$/, '')

const nextConfig: NextConfig = {
	output: 'standalone',
	compress: true,
	reactStrictMode: true,
	generateEtags: true,
	skipMiddlewareUrlNormalize: true,
	// Пути API заканчиваются слешем (/employer/actors/all/). По умолчанию Next
	// отвечает на такие адреса редиректом 308 без слеша — прокси ниже получал бы
	// путь без слеша, бэкенд отвечал бы своим редиректом уже на собственный
	// домен, и запрос уходил бы в цикл. Отключаем нормализацию, чтобы адрес
	// доходил до прокси как есть.
	skipTrailingSlashRedirect: true,
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
			{
				// Service worker решает, что установленное приложение получит из сети,
				// а что из кеша, поэтому его собственный файл кешировать нельзя: пока
				// браузер отдаёт старую копию, до людей не доходят исправления самой
				// стратегии кеширования. По умолчанию он отдавался на четыре часа.
				source: '/sw.js',
				headers: [
					{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
					{ key: 'Service-Worker-Allowed', value: '/' },
				],
			},
		]
	},
	// Фото и обложки, которые API отдаёт сам (не ушедшие в S3), лежат по
	// /uploads/ и в базе хранятся без домена — клиент запрашивает их с корня
	// текущего домена. Без этого правила они попадали бы на фронтенд и отдавали
	// 404, то есть выглядели бы как битые картинки.
	//
	// Раньше и это, и /api/ разводил внешний nginx-прокси, из-за чего домен
	// зависел от отдельного сервера: когда он перестал отвечать, приложение
	// вставало на «Загрузка...». Теперь тем же занимается само приложение
	// (/api/ — в middleware.ts), поэтому домен может смотреть прямо на этот
	// сервис. Побочно сохраняется same-origin: без CORS и без второго домена
	// в запросах браузера.
	async rewrites() {
		return [
			{
				source: '/uploads/:path*',
				destination: `${apiProxyTarget}/uploads/:path*`,
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
