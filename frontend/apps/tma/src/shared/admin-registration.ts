/**
 * Признак «человек пришёл по ссылке для регистрации админов» — /login?admin=1.
 *
 * Зачем это отдельно от выбранной роли. Регистрация идёт в несколько шагов и
 * через внешний вход: Telegram OAuth уводит на oauth.telegram.org, вход по
 * почте — на экран с кодом. После возврата адрес страницы уже другой, `admin=1`
 * в нём нет. Пока признак жил только в адресе, на шаге выбора роли он терялся,
 * и человек по админской ссылке видел окно регистрации актёра.
 *
 * Пишем и в localStorage, и в cookie. Cookie нужна на случай, когда встроенный
 * браузер (Telegram, VK) отдаёт страницу без сохранённого localStorage, и
 * чтобы серверный middleware мог поставить признак ещё до загрузки React.
 */
const KEY = 'pp_admin_registration'
/**
 * Признак «иконку на домашнем экране создали с админской ссылки» — по нему
 * middleware возвращает `admin=1` при запуске установленного приложения.
 * Снимаем вместе с основным: иначе человек, передумавший регистрироваться
 * админом, каждый раз попадал бы обратно на админский экран.
 */
const PWA_KEY = 'pp_admin_registration_pwa'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60

export const markAdminRegistration = () => {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(KEY, '1')
	} catch {}
	try {
		document.cookie = `${KEY}=1; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
	} catch {}
}

export const isAdminRegistration = (): boolean => {
	if (typeof window === 'undefined') return false
	try {
		if (window.localStorage.getItem(KEY) === '1') return true
	} catch {}
	try {
		return document.cookie
			.split(';')
			.some(part => part.trim() === `${KEY}=1`)
	} catch {}
	return false
}

/**
 * Снимаем признак, когда человек осознанно регистрируется актёром или агентом.
 * Иначе один заход по админской ссылке навсегда закрыл бы на этом устройстве
 * обычную регистрацию.
 */
export const clearAdminRegistration = () => {
	if (typeof window === 'undefined') return
	for (const key of [KEY, PWA_KEY]) {
		try {
			window.localStorage.removeItem(key)
		} catch {}
		try {
			document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`
		} catch {}
	}
}
