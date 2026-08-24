/**
 * Сброс кеша PWA. Нужен там, где приложение не смогло запуститься: файлы
 * сборки service worker отдаёт cache-first, поэтому обычная перезагрузка
 * возвращает те же нерабочие файлы, и человек остаётся на пустом или
 * загрузочном экране до ручной переустановки приложения.
 */

const CACHE_PREFIX = 'prostoprobuy-pwa-'

/** Удалить кеши PWA и попросить service worker обновиться. Никогда не бросает. */
export async function resetPwaCaches(): Promise<void> {
	try {
		if (typeof caches !== 'undefined') {
			const keys = await caches.keys()
			await Promise.all(
				keys
					.filter(key => key.startsWith(CACHE_PREFIX))
					.map(key => caches.delete(key)),
			)
		}
	} catch {
		// Cache Storage недоступен — перезагрузимся как есть.
	}
	try {
		const registration = await navigator.serviceWorker?.getRegistration()
		await registration?.update()
	} catch {
		// Обновление worker'а — необязательный шаг.
	}
}

/**
 * Сбросить кеш и открыть приложение заново. `target` позволяет уйти не на
 * текущий адрес, а, например, сразу на страницу входа.
 */
export async function resetPwaCachesAndReload(target?: string): Promise<void> {
	await resetPwaCaches()
	if (target) {
		window.location.replace(target)
		return
	}
	window.location.reload()
}
