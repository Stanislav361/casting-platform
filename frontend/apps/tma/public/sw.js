// Версию поднимаем при каждой правке кеширования и когда нужно принудительно
// сбросить кеш у уже установленных приложений: в activate удаляются все кеши с
// другой версией, поэтому смена номера гарантированно выбрасывает старые файлы.
const CACHE_VERSION = 'prostoprobuy-pwa-v26'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

// HTML корневой страницы — оболочка приложения. Установленное приложение
// запускается с адреса /?source=pwa, и раньше этот запрос шёл только в сеть: один
// сбой при старте (а на iOS первый запрос после запуска с ярлыка срывается
// регулярно, даже когда интернет есть) — и вместо приложения открывалась
// страница «Нет подключения», из которой некуда идти. Сохранённая оболочка
// позволяет открыться и продолжить работу, а свежую версию она подтягивает
// следующим запуском.
const SHELL_URL = '/'

const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/admin-manifest.webmanifest',
  '/admin-register-manifest.webmanifest',
  '/logo.svg',
  '/logo-big.svg',
  '/pwa/icon-180-v3.png',
  '/pwa/icon-192-v3.png',
  '/pwa/icon-512-v3.png',
  '/pwa/icon-maskable-512-v3.png'
]

// Сохранить оболочку приложения. Ошибку глушим: без неё приложение просто
// потеряет возможность открыться при сбое сети, но ломать из-за этого установку
// service worker'а нельзя.
async function cacheAppShell() {
  try {
    const response = await fetch(SHELL_URL, { cache: 'no-store' })
    if (!response || !response.ok) return
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.put(SHELL_URL, response)
  } catch {
    // Сеть недоступна — оболочка сохранится при первом удачном открытии.
  }
}

// Выбросить сохранённую оболочку. Нужно, когда выяснилось, что она устарела:
// HTML из кеша ссылается на файлы сборки прошлой версии, которых на сервере уже
// нет. Пока такая оболочка лежит в кеше, каждое открытие без сети собирает
// страницу из мёртвых ссылок — человек видит пустой экран или «Произошла
// ошибка», и обычная перезагрузка ничего не меняет.
async function dropCachedShell() {
  try {
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.delete(SHELL_URL)
  } catch {
    // Кеш недоступен — оболочка обновится при следующей активации worker'а.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => cacheAppShell())
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('prostoprobuy-pwa-') && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

function isApiRequest(request) {
  const url = new URL(request.url)
  return url.pathname.startsWith('/api/') || url.pathname.includes('/employer/') || url.pathname.includes('/auth/')
}

function isStaticAsset(request) {
  const url = new URL(request.url)
  return (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/pwa/')
  )
}

// Неизменяемые build-ассеты Next.js (/_next/static/...) имеют хэш в имени файла,
// поэтому их содержимое никогда не меняется. Их нужно отдавать cache-first —
// мгновенно из кэша, без ожидания сети. Раньше они шли network-first, и каждый
// переход между страницами ждал загрузку JS-чанков по сети.
function isImmutableBuildAsset(request) {
  const url = new URL(request.url)
  return url.pathname.startsWith('/_next/static/')
}

// Сколько ждём сеть при открытии приложения. Когда оболочка уже сохранена, ждём
// недолго и открываемся из неё; когда открываться пока не из чего — ждём с
// запасом, чтобы медленная мобильная сеть не приводила к «Нет подключения».
const NAVIGATION_TIMEOUT_MS = 8000
const NAVIGATION_TIMEOUT_COLD_MS = 30000
// Сколько раз пробуем загрузить страницу, прежде чем открыться из кеша. Обрыв
// соединения на мобильной сети — штатное событие, и вторая попытка почти всегда
// проходит: лучше подождать её, чем открыть приложение из вчерашней оболочки.
const NAVIGATION_ATTEMPTS = 2
const ASSET_TIMEOUT_MS = 20000
// Генерация каст листа в PDF занимает десятки секунд, поэтому запросам к API
// нужен запас: здесь таймаут — только страховка от полностью зависшего
// соединения, а свои сроки ответа задаёт сам клиент (см. shared/api-client.ts).
const API_TIMEOUT_MS = 240000

// Запрос из service worker'а, который гарантированно завершается.
//
// Мобильные сети и VPN умеют «проглатывать» соединение: ответ не приходит, но и
// ошибки нет. Ответ на fetch-событие в этом случае не наступает никогда, и
// страница вместе с её файлами сборки висит на загрузке без единой ошибки в
// консоли. Ограничиваем ожидание, чтобы вызывающая сторона могла отдать ответ из
// кеша. Пересоздавать Request нельзя (у навигаций mode='navigate', такой Request
// конструктор не принимает), поэтому исходный запрос не отменяем, а просто
// перестаём его ждать.
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`sw fetch timeout after ${timeoutMs}ms`)),
      timeoutMs,
    )
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

async function networkFirstWithCache(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const fresh = await fetchWithTimeout(request, ASSET_TIMEOUT_MS)
    if (fresh && fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}

// Cache-first: для неизменяемых хэшированных ассетов. Если есть в кэше —
// отдаём мгновенно и не ходим в сеть; иначе грузим и кладём в кэш.
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  // Если сеть не ответила за отведённое время, отдаём ошибку, а не ждём дальше:
  // приложение получит ChunkLoadError и сбросит кэш (см. shared/app-recovery).
  const fresh = await fetchWithTimeout(request, ASSET_TIMEOUT_MS)
  if (fresh && fresh.ok) {
    cache.put(request, fresh.clone())
    return fresh
  }
  // Файла сборки на сервере больше нет — значит страницу собрал устаревший HTML
  // из кеша. Выбрасываем оболочку сразу, иначе следующее открытие повторит то же
  // падение, а человеку останется только переустанавливать приложение.
  if (fresh && (fresh.status === 404 || fresh.status === 410)) {
    await dropCachedShell()
  }
  return fresh
}

// Страницу читаем целиком, а не отдаём потоком.
//
// Мобильная сеть рвёт соединение посреди ответа — в логах прода это
// `[Error: aborted] { code: 'ECONNRESET' }`. Браузер в таком случае получает
// обрезанный HTML: разметка есть, а код приложения — нет, и вместо приложения
// остаётся пустой экран либо падение гидрации. Прочитанный до конца ответ
// позволяет заметить обрыв и повторить запрос. Документ у нас около 40 КБ,
// поэтому потоковая отдача всё равно ничего не выигрывала.
// Ответы без тела (204, 205, 304) пересобирать нельзя — конструктор Response
// на них падает.
const BODYLESS_STATUSES = [204, 205, 304]

async function readFully(response) {
  if (BODYLESS_STATUSES.includes(response.status)) return response

  const body = await response.arrayBuffer()
  const headers = new Headers(response.headers)
  // Тело уже распаковано и длина у него другая: оставить старые заголовки —
  // значит попросить браузер распаковать распакованное и прочитать больше
  // байт, чем есть.
  headers.delete('content-encoding')
  headers.delete('content-length')
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// Открытие приложения (запуск с ярлыка, обновление страницы, переход по ссылке).
//
// Порядок такой: сеть (с повторной попыткой), затем сохранённая оболочка и
// только в самом конце страница «Нет подключения». Именно последний шаг раньше
// был вторым, поэтому единственный сорвавшийся запрос на старте выглядел как
// отсутствие интернета.
async function handleNavigation(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const shell = await cache.match(SHELL_URL)
  // Открытие из кеша — не повод оставлять там старый HTML: обновляем оболочку
  // в фоне, чтобы следующий запуск шёл на файлах текущей версии. Без этого один
  // обрыв связи «консервировал» прошлую сборку на всё время жизни кеша.
  const refreshShell = () => { void cacheAppShell() }
  // Если оболочка уже сохранена, нет смысла долго держать человека на пустом
  // экране: приложение откроется из неё, а свежий HTML попадёт в кеш при
  // следующем запуске.
  const timeout = shell ? NAVIGATION_TIMEOUT_MS : NAVIGATION_TIMEOUT_COLD_MS
  let lastError = null

  for (let attempt = 0; attempt < NAVIGATION_ATTEMPTS; attempt++) {
    try {
      const fresh = await fetchWithTimeout(request, timeout)
      // Ошибку сервера отдаём как есть: повторять её бессмысленно, а страницу
      // с сообщением человек должен увидеть.
      if (!fresh || !fresh.ok) return fresh

      const full = await readFully(fresh)
      if (new URL(request.url).pathname === SHELL_URL) {
        // Кешируем только корневой документ: с него запускается приложение, а
        // страницы вида /report/<токен> в кеше держать не нужно.
        cache.put(SHELL_URL, full.clone())
      }
      return full
    } catch (error) {
      // Сюда попадают и обрыв соединения, и таймаут: обе причины лечатся одной
      // повторной попыткой — она обычно проходит, потому что соединение
      // устанавливается заново.
      lastError = error
    }
  }

  if (shell) {
    refreshShell()
    return shell
  }
  const offlinePage = await caches.match('/offline.html')
  if (offlinePage) return offlinePage
  throw lastError || new Error('navigation failed')
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  const refresh = fetchWithTimeout(request, ASSET_TIMEOUT_MS)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone())
      return response
    })
    .catch((error) => {
      // Отдать `undefined` в respondWith нельзя — пробрасываем ошибку, чтобы
      // браузер обработал её как обычный сбой сети.
      if (cached) return cached
      throw error
    })

  return cached || refresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  if (isApiRequest(request)) {
    event.respondWith(fetchWithTimeout(request, API_TIMEOUT_MS))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  // Хэшированные build-ассеты — мгновенно из кэша (cache-first). Ускоряет
  // переходы между страницами: JS-чанки больше не ждут сеть.
  if (isImmutableBuildAsset(request)) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

/* ─── Web Push ─────────────────────────────────────────── */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'prostoprobuy.pro',
    body: 'Новое уведомление',
    url: '/notifications',
    data: {},
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || parsed.message || payload.body,
        url: parsed.url || payload.url,
        data: parsed.data || {},
      }
    } catch {
      const text = event.data.text()
      if (text) payload.body = text
    }
  }

  const options = {
    body: payload.body,
    icon: '/pwa/icon-192-v3.png',
    badge: '/pwa/icon-192-v3.png',
    tag: `notif-${payload.data?.notification_id || Date.now()}`,
    data: { url: payload.url, ...payload.data },
    vibrate: [80, 40, 80],
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/notifications'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const origin = self.location.origin
        for (const client of clientList) {
          try {
            const url = new URL(client.url)
            if (url.origin === origin && 'focus' in client) {
              client.postMessage({ type: 'NAVIGATE', url: targetUrl })
              return client.focus()
            }
          } catch {
            // ignore parsing errors
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
        return null
      })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  // Браузер обновил подписку — попросим клиентов обновить её на сервере
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' }))
    })
  )
})
