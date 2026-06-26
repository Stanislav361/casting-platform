const CACHE_VERSION = 'prostoprobuy-pwa-v20'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/admin-manifest.webmanifest',
  '/logo.svg',
  '/logo-big.svg',
  '/pwa/icon-180-v3.png',
  '/pwa/icon-192-v3.png',
  '/pwa/icon-512-v3.png',
  '/pwa/icon-maskable-512-v3.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
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

async function networkFirstWithCache(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const fresh = await fetch(request)
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
  const fresh = await fetch(request)
  if (fresh && fresh.ok) cache.put(request, fresh.clone())
  return fresh
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request)
    return fresh
  } catch (error) {
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html')
      if (offlinePage) return offlinePage
    }
    throw error
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)

  return cached || refresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  if (isApiRequest(request)) {
    event.respondWith(networkFirst(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
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
