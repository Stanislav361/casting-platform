const CACHE_VERSION = 'prostoprobuy-pwa-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/logo.svg',
  '/logo-big.svg',
  '/pwa/icon-180.png',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/icon-maskable-512.png'
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

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

// ─── Web Push ─────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'ProstoProbuy', body: 'Новое уведомление', url: '/notifications' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      vibrate: [100, 50, 100],
      tag: data.url || 'prostoprobuy',
      renotify: true,
      data: { url: data.url || '/notifications' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/notifications'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
