// Версию поднимаем при каждой правке кеширования и когда нужно принудительно
// сбросить кеш у уже установленных приложений: в activate удаляются все кеши с
// другой версией, поэтому смена номера гарантированно выбрасывает старые файлы.
const CACHE_VERSION = 'prostoprobuy-pwa-v27'
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

// Адреса, HTML которых храним отдельно от оболочки.
//
// Оболочка — документ корневого адреса. При сбое сети она отдавалась в ответ на
// любой запрос страницы: в адресной строке оставался, например,
// /login?admin=1, а приложение поднималось как корневая страница и уводило
// человека на общий вход — ссылка для регистрации администраторов открывала
// регистрацию актёра. Поэтому документы страниц входа держим в кеше по их
// собственному пути и при сбое сети отдаём именно их.
//
// Ключ — путь без параметров: страницы отрисовываются на клиенте, поэтому HTML
// у /login и /login?admin=1 одинаковый, а параметры приложение читает из
// адреса. Список закрытый: страницы вида /report/<токен> в кеше не нужны.
const CACHED_DOCUMENT_PATHS = [
  SHELL_URL,
  '/login',
  '/login/role',
  '/login/email',
  '/login/phone',
  '/admin-login',
  '/admin-register'
]

// Документы, которые сохраняем сразу при установке. Первое открытие идёт мимо
// service worker'а (он в этот момент только устанавливается), поэтому без
// предварительного сохранения страница входа попала бы в кеш лишь со второго
// удачного захода — а именно второй заход и ломался.
const PRECACHED_DOCUMENT_PATHS = [SHELL_URL, '/login']

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

// Путь, под которым храним HTML запрошенного адреса, или null, если такой адрес
// кешировать не нужно. Параметры и завершающий слеш отбрасываем, чтобы
// /login?admin=1 и /login/ попадали в ту же запись, что и /login.
function documentCacheKey(url) {
  let pathname
  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }
  const normalized = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname
  return CACHED_DOCUMENT_PATHS.includes(normalized) ? normalized : null
}

// Копия ответа для кеша — без Set-Cookie.
//
// Cookie сервер ставит в ответ на конкретный запрос: middleware добавляет признак
// админской регистрации к /login?admin=1. Этот же HTML лежит в кеше под путём
// /login и позже отдаётся любому заходу на страницу входа — вместе с ним
// вернулись бы и cookie, то есть снятый признак ожил бы сам собой.
function forCache(response) {
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// Сохранить HTML страницы. Ошибку глушим: без сохранённого документа приложение
// просто потеряет возможность открыться при сбое сети, но ломать из-за этого
// установку service worker'а нельзя.
async function cacheDocument(path) {
  try {
    const response = await fetch(path, { cache: 'no-store' })
    if (!response || !response.ok) return
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.put(path, forCache(await readFully(response)))
  } catch {
    // Сеть недоступна — документ сохранится при первом удачном открытии.
  }
}

// Выбросить сохранённые документы. Нужно, когда выяснилось, что они устарели:
// HTML из кеша ссылается на файлы сборки прошлой версии, которых на сервере уже
// нет. Пока такой HTML лежит в кеше, каждое открытие без сети собирает страницу
// из мёртвых ссылок — человек видит пустой экран или «Произошла ошибка», и
// обычная перезагрузка ничего не меняет. Чистим все документы сразу: они собраны
// одной сборкой и ссылаются на одни и те же файлы.
async function dropCachedDocuments() {
  try {
    const cache = await caches.open(RUNTIME_CACHE)
    await Promise.all(CACHED_DOCUMENT_PATHS.map((path) => cache.delete(path)))
  } catch {
    // Кеш недоступен — документы обновятся при следующей активации worker'а.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => Promise.all(PRECACHED_DOCUMENT_PATHS.map((path) => cacheDocument(path))))
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
  // из кеша. Выбрасываем сохранённые документы сразу, иначе следующее открытие
  // повторит то же падение, а человеку останется только переустанавливать
  // приложение.
  if (fresh && (fresh.status === 404 || fresh.status === 410)) {
    await dropCachedDocuments()
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
  const cacheKey = documentCacheKey(request.url)
  // Сначала ищем HTML именно запрошенного адреса и только потом берём оболочку:
  // подменять страницу входа корневым документом нельзя — приложение поднимется
  // как корневая страница и потеряет параметры адреса (в том числе admin=1).
  const cachedDocument = cacheKey ? await cache.match(cacheKey) : undefined
  const fallback = cachedDocument || await cache.match(SHELL_URL)
  // Открытие из кеша — не повод оставлять там старый HTML: обновляем документы
  // в фоне, чтобы следующий запуск шёл на файлах текущей версии. Без этого один
  // обрыв связи «консервировал» прошлую сборку на всё время жизни кеша.
  const refreshDocuments = () => {
    void cacheDocument(SHELL_URL)
    if (cacheKey && cacheKey !== SHELL_URL) void cacheDocument(cacheKey)
  }
  // Если открываться уже есть из чего, нет смысла долго держать человека на
  // пустом экране: приложение откроется из кеша, а свежий HTML попадёт туда при
  // следующем запуске.
  const timeout = fallback ? NAVIGATION_TIMEOUT_MS : NAVIGATION_TIMEOUT_COLD_MS
  let lastError = null

  for (let attempt = 0; attempt < NAVIGATION_ATTEMPTS; attempt++) {
    try {
      const fresh = await fetchWithTimeout(request, timeout)
      // Ошибку сервера отдаём как есть: повторять её бессмысленно, а страницу
      // с сообщением человек должен увидеть.
      if (!fresh || !fresh.ok) return fresh

      const full = await readFully(fresh)
      if (cacheKey) cache.put(cacheKey, forCache(full.clone()))
      return full
    } catch (error) {
      // Сюда попадают и обрыв соединения, и таймаут: обе причины лечатся одной
      // повторной попыткой — она обычно проходит, потому что соединение
      // устанавливается заново.
      lastError = error
    }
  }

  if (fallback) {
    refreshDocuments()
    return fallback
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
