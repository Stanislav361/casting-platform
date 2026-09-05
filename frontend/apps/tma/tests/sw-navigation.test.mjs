/**
 * Тесты service worker'а: открытие приложения и файлы сборки.
 *
 * Эта логика уже несколько раз ломала прод («нет интернета» при живой сети,
 * пустой экран после деплоя), а в браузере её не отладить: worker живёт вне
 * страницы и переживает перезагрузки. Поэтому sw.js запускается здесь в
 * поддельном окружении (self / caches / fetch), а проверки идут через настоящий
 * обработчик события fetch — так же, как его вызывает браузер.
 *
 * Запуск: node tests/sw-navigation.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SW_SOURCE = readFileSync(resolve(here, '../public/sw.js'), 'utf8')
// Версию кеша поднимают при каждой правке кеширования, поэтому берём её из
// самого worker'а: иначе тесты пришлось бы править вместе с ней и они бы молча
// проверяли пустой кеш.
const RUNTIME_CACHE = `${/const CACHE_VERSION = '([^']+)'/.exec(SW_SOURCE)[1]}-runtime`

let failures = 0

const check = (name, ok, details = '') => {
	if (!ok) failures += 1
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${details && !ok ? ` — ${details}` : ''}`)
}

/** Минимальный Cache Storage в памяти: ключ — URL запроса. */
class FakeCache {
	constructor() { this.entries = new Map() }
	async match(request) {
		const key = typeof request === 'string' ? request : request.url
		const stored = this.entries.get(key) || this.entries.get(new URL(key, 'https://app.test').pathname)
		return stored ? stored.clone() : undefined
	}
	async put(request, response) {
		const key = typeof request === 'string' ? request : request.url
		this.entries.set(key.startsWith('http') ? new URL(key).pathname : key, response)
	}
	async delete(request) {
		const key = typeof request === 'string' ? request : request.url
		return this.entries.delete(key.startsWith('http') ? new URL(key).pathname : key)
	}
	async addAll() { /* статические файлы в тестах не нужны */ }
}

const makeEnvironment = ({ fetchImpl }) => {
	const caches = {
		store: new Map(),
		async open(name) {
			if (!this.store.has(name)) this.store.set(name, new FakeCache())
			return this.store.get(name)
		},
		async keys() { return [...this.store.keys()] },
		async delete(name) { return this.store.delete(name) },
		async match(request) {
			for (const cache of this.store.values()) {
				const hit = await cache.match(request)
				if (hit) return hit
			}
			return undefined
		},
	}

	const handlers = new Map()
	const self = {
		addEventListener: (type, handler) => handlers.set(type, handler),
		skipWaiting: async () => {},
		clients: { claim: async () => {}, matchAll: async () => [] },
		location: { origin: 'https://app.test' },
		registration: { showNotification: async () => {} },
	}

	// sw.js рассчитан на глобальные self/caches/fetch — подставляем их явно,
	// чтобы не трогать реальные глобальные объекты процесса.
	const load = new Function('self', 'caches', 'fetch', SW_SOURCE)
	load(self, caches, fetchImpl)

	const fireFetch = (request) => {
		const handler = handlers.get('fetch')
		let answer
		handler({ request, respondWith: (value) => { answer = value } })
		return answer
	}

	return { caches, fireFetch }
}

/** Ответ, у которого соединение обрывается посреди тела. */
const truncatedResponse = () => new Response(
	new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode('<!DOCTYPE html><html><head>'))
			controller.error(new Error('aborted'))
		},
	}),
	{ status: 200, headers: { 'Content-Type': 'text/html' } },
)

const navigationRequest = (url = 'https://app.test/') =>
	({ url, method: 'GET', mode: 'navigate', destination: 'document' })

const assetRequest = (url) =>
	({ url, method: 'GET', mode: 'no-cors', destination: 'script' })

async function testTruncatedNavigationIsRetried() {
	let calls = 0
	const { fireFetch } = makeEnvironment({
		fetchImpl: async () => {
			calls += 1
			// Первый ответ рвётся, второй приходит целиком — так ведёт себя
			// мобильная сеть, дающая ECONNRESET.
			return calls === 1
				? truncatedResponse()
				: new Response('<!DOCTYPE html><html>ok</html>', { status: 200 })
		},
	})

	const response = await fireFetch(navigationRequest())
	const body = await response.text()
	check('обрыв соединения не показывается человеку — запрос повторяется',
		calls === 2 && body.includes('ok'), `попыток: ${calls}, тело: ${body.slice(0, 40)}`)
}

async function testShellFallbackAfterRepeatedFailures() {
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => { throw new Error('aborted') },
	})
	const runtime = await caches.open(RUNTIME_CACHE)
	await runtime.put('/', new Response('<!DOCTYPE html>оболочка', { status: 200 }))

	const response = await fireFetch(navigationRequest())
	const body = await response.text()
	check('когда сеть недоступна, приложение открывается из сохранённой оболочки',
		body.includes('оболочка'), body.slice(0, 60))
}

async function testFreshShellIsCached() {
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => new Response('<!DOCTYPE html>свежая', { status: 200 }),
	})

	await fireFetch(navigationRequest())
	const runtime = await caches.open(RUNTIME_CACHE)
	const cached = await runtime.match('/')
	check('свежая оболочка попадает в кеш', Boolean(cached))
	if (cached) {
		const body = await cached.text()
		check('в кеше лежит именно новый HTML', body.includes('свежая'), body.slice(0, 40))
	}
}

async function testMissingChunkDropsStaleShell() {
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => new Response('not found', { status: 404 }),
	})
	const runtime = await caches.open(RUNTIME_CACHE)
	await runtime.put('/', new Response('<!DOCTYPE html>старая оболочка', { status: 200 }))

	await fireFetch(assetRequest('https://app.test/_next/static/chunks/old-hash.js'))
	const shell = await runtime.match('/')
	check('исчезнувший файл сборки выбрасывает устаревшую оболочку из кеша',
		shell === undefined)
}

/**
 * Из-за этого ссылка регистрации администраторов открывала регистрацию актёра:
 * при сбое сети worker отдавал корневую оболочку на любой адрес, приложение
 * поднималось как корневая страница и уводило человека на общий /login, теряя
 * admin=1.
 */
async function testLoginDocumentServedInsteadOfShell() {
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => { throw new Error('aborted') },
	})
	const runtime = await caches.open(RUNTIME_CACHE)
	await runtime.put('/', new Response('<!DOCTYPE html>корневая страница', { status: 200 }))
	await runtime.put('/login', new Response('<!DOCTYPE html>страница входа', { status: 200 }))

	const response = await fireFetch(navigationRequest('https://app.test/login?admin=1'))
	const body = await response.text()
	check('без сети /login?admin=1 открывается страницей входа, а не корневой оболочкой',
		body.includes('страница входа'), body.slice(0, 60))
}

async function testLoginDocumentCachedWithoutQuery() {
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => new Response('<!DOCTYPE html>вход', { status: 200 }),
	})

	await fireFetch(navigationRequest('https://app.test/login?admin=1'))
	const runtime = await caches.open(RUNTIME_CACHE)
	const cached = await runtime.match('/login')
	check('HTML страницы входа сохраняется под адресом без параметров',
		Boolean(cached))
}

/**
 * Cookie относятся к тому запросу, в ответ на который их поставили. Останься они
 * в сохранённом HTML — снятый признак админской регистрации возвращался бы сам.
 */
async function testCachedDocumentHasNoCookies() {
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => new Response('<!DOCTYPE html>вход', {
			status: 200,
			headers: { 'Set-Cookie': 'pp_admin_registration=1; Path=/' },
		}),
	})

	const fresh = await fireFetch(navigationRequest('https://app.test/login?admin=1'))
	check('свежий ответ отдаётся человеку вместе с cookie',
		fresh.headers.getSetCookie().length === 1)

	const runtime = await caches.open(RUNTIME_CACHE)
	const cached = await runtime.match('/login')
	check('в кеш HTML попадает без Set-Cookie',
		Boolean(cached) && cached.headers.getSetCookie().length === 0)
}

/** Одноразовые адреса в кеше держать нельзя: там персональные данные. */
async function testDisposableRouteIsNotCached() {
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => new Response('<!DOCTYPE html>каст-лист', { status: 200 }),
	})

	await fireFetch(navigationRequest('https://app.test/report/secret-token'))
	const runtime = await caches.open(RUNTIME_CACHE)
	const cached = await runtime.match('/report/secret-token')
	check('страница по одноразовой ссылке в кеш не попадает', cached === undefined)
}

async function testCachedChunkServedWithoutNetwork() {
	let calls = 0
	const { caches, fireFetch } = makeEnvironment({
		fetchImpl: async () => { calls += 1; return new Response('из сети', { status: 200 }) },
	})
	const runtime = await caches.open(RUNTIME_CACHE)
	const url = 'https://app.test/_next/static/chunks/known.js'
	await runtime.put(url, new Response('из кеша', { status: 200 }))

	const response = await fireFetch(assetRequest(url))
	const body = await response.text()
	check('файл сборки из кеша отдаётся без обращения к сети',
		body === 'из кеша' && calls === 0, `тело: ${body}, запросов: ${calls}`)
}

const tests = [
	testTruncatedNavigationIsRetried,
	testShellFallbackAfterRepeatedFailures,
	testFreshShellIsCached,
	testMissingChunkDropsStaleShell,
	testLoginDocumentServedInsteadOfShell,
	testLoginDocumentCachedWithoutQuery,
	testCachedDocumentHasNoCookies,
	testDisposableRouteIsNotCached,
	testCachedChunkServedWithoutNetwork,
]

for (const test of tests) {
	try {
		await test()
	} catch (error) {
		failures += 1
		console.log(`FAIL ${test.name} — исключение: ${error?.stack || error}`)
	}
}

console.log(failures === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
