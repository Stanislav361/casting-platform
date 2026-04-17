import type { AppRole } from './use-role'

export interface NavItem {
	id: string
	label: string
	href: string
	icon: string
	primary?: boolean // показывать в мобильном нижнем баре
	section?: string  // id секции (для группировки в сайдбаре/ящике)
}

export interface NavSectionDef {
	id: string
	title: string
}

export const NAV_SECTIONS: NavSectionDef[] = [
	{ id: 'me',      title: 'Моя страница' },
	{ id: 'work',    title: 'Основная работа' },
	{ id: 'comm',    title: 'Коммуникации' },
	{ id: 'saved',   title: 'Сохранённое' },
	{ id: 'system',  title: 'Система' },
]

// ─────────────────────────────────────────────────────────────
// Меню по ролям
// ─────────────────────────────────────────────────────────────

const NAV_BY_ROLE: Record<string, NavItem[]> = {
	// ── 1. Супер Админ ───────────────────────────────────────
	owner: [
		{ id: 'me-page',      label: 'Моя страница',     href: '/me',                  icon: 'user',    section: 'me',     primary: false },

		{ id: 'projects',     label: 'Проекты',           href: '/dashboard',           icon: 'folder',  section: 'work',   primary: true  },
		{ id: 'castings',     label: 'Кастинги',          href: '/dashboard/castings',  icon: 'film',    section: 'work',   primary: true  },
		{ id: 'reports',      label: 'Отчёты',            href: '/dashboard/reports',   icon: 'report',  section: 'work',   primary: false },
		{ id: 'actors',       label: 'База актёров',      href: '/dashboard/actors',    icon: 'users',   section: 'work',   primary: true  },

		{ id: 'chats',        label: 'Чаты',              href: '/chats',               icon: 'chat',    section: 'comm',   primary: false },
		{ id: 'notifications',label: 'Уведомления',       href: '/notifications',       icon: 'bell',    section: 'comm',   primary: false },

		{ id: 'favorites',    label: 'Избранные',         href: '/dashboard/actors?favorites=true', icon: 'heart', section: 'saved', primary: false },

		{ id: 'users',        label: 'Пользователи',      href: '/dashboard/admin',     icon: 'shield',  section: 'system', primary: false },
		{ id: 'team',         label: 'Команда',           href: '/dashboard/team',      icon: 'users',   section: 'system', primary: false },
		{ id: 'settings',     label: 'Настройки',         href: '/settings',            icon: 'settings',section: 'system', primary: false },
		{ id: 'logout',       label: 'Выйти',             href: '/login',               icon: 'logout',  section: 'system', primary: false },
	],

	// ── 2. Админ PRO ─────────────────────────────────────────
	employer_pro: [
		{ id: 'me-page',      label: 'Моя страница',     href: '/me',                  icon: 'user',    section: 'me',     primary: false },

		{ id: 'projects',     label: 'Проекты',           href: '/dashboard',           icon: 'folder',  section: 'work',   primary: true  },
		{ id: 'castings',     label: 'Кастинги',          href: '/dashboard/castings',  icon: 'film',    section: 'work',   primary: true  },
		{ id: 'reports',      label: 'Отчёты',            href: '/dashboard/reports',   icon: 'report',  section: 'work',   primary: false },
		{ id: 'actors',       label: 'База актёров',      href: '/dashboard/actors',    icon: 'users',   section: 'work',   primary: true  },

		{ id: 'chats',        label: 'Чаты',              href: '/chats',               icon: 'chat',    section: 'comm',   primary: false },
		{ id: 'notifications',label: 'Уведомления',       href: '/notifications',       icon: 'bell',    section: 'comm',   primary: false },

		{ id: 'favorites',    label: 'Избранные',         href: '/dashboard/actors?favorites=true', icon: 'heart', section: 'saved', primary: false },

		{ id: 'settings',     label: 'Настройки',         href: '/settings',            icon: 'settings',section: 'system', primary: false },
		{ id: 'logout',       label: 'Выйти',             href: '/login',               icon: 'logout',  section: 'system', primary: false },
	],

	// ── 3. Обычный Админ ─────────────────────────────────────
	employer: [
		{ id: 'me-page',      label: 'Моя страница',     href: '/me',                  icon: 'user',    section: 'me',     primary: false },

		{ id: 'projects',     label: 'Мои проекты',       href: '/dashboard',           icon: 'folder',  section: 'work',   primary: true  },
		{ id: 'castings',     label: 'Мои кастинги',      href: '/dashboard/castings',  icon: 'film',    section: 'work',   primary: true  },
		{ id: 'reports',      label: 'Отчёты',            href: '/dashboard/reports',   icon: 'report',  section: 'work',   primary: false },

		{ id: 'chats',        label: 'Чаты',              href: '/chats',               icon: 'chat',    section: 'comm',   primary: false },
		{ id: 'notifications',label: 'Уведомления',       href: '/notifications',       icon: 'bell',    section: 'comm',   primary: false },

		{ id: 'favorites',    label: 'Избранные',         href: '/dashboard/actors?favorites=true', icon: 'heart', section: 'saved', primary: false },

		{ id: 'settings',     label: 'Настройки',         href: '/settings',            icon: 'settings',section: 'system', primary: false },
		{ id: 'logout',       label: 'Выйти',             href: '/login',               icon: 'logout',  section: 'system', primary: false },
	],

	// ── Администратор (внутренний) ───────────────────────────
	administrator: [
		{ id: 'me-page',      label: 'Моя страница',     href: '/me',                  icon: 'user',    section: 'me',     primary: false },

		{ id: 'projects',     label: 'Проекты',           href: '/dashboard',           icon: 'folder',  section: 'work',   primary: true  },
		{ id: 'castings',     label: 'Кастинги',          href: '/dashboard/castings',  icon: 'film',    section: 'work',   primary: true  },
		{ id: 'reports',      label: 'Отчёты',            href: '/dashboard/reports',   icon: 'report',  section: 'work',   primary: false },
		{ id: 'actors',       label: 'База актёров',      href: '/dashboard/actors',    icon: 'users',   section: 'work',   primary: true  },

		{ id: 'chats',        label: 'Чаты',              href: '/chats',               icon: 'chat',    section: 'comm',   primary: false },
		{ id: 'notifications',label: 'Уведомления',       href: '/notifications',       icon: 'bell',    section: 'comm',   primary: false },

		{ id: 'favorites',    label: 'Избранные',         href: '/dashboard/actors?favorites=true', icon: 'heart', section: 'saved', primary: false },

		{ id: 'settings',     label: 'Настройки',         href: '/settings',            icon: 'settings',section: 'system', primary: false },
		{ id: 'logout',       label: 'Выйти',             href: '/login',               icon: 'logout',  section: 'system', primary: false },
	],

	// ── Менеджер ─────────────────────────────────────────────
	manager: [
		{ id: 'me-page',      label: 'Моя страница',     href: '/me',                  icon: 'user',    section: 'me',     primary: false },

		{ id: 'projects',     label: 'Проекты',           href: '/dashboard',           icon: 'folder',  section: 'work',   primary: true  },
		{ id: 'castings',     label: 'Кастинги',          href: '/dashboard/castings',  icon: 'film',    section: 'work',   primary: true  },
		{ id: 'reports',      label: 'Отчёты',            href: '/dashboard/reports',   icon: 'report',  section: 'work',   primary: false },

		{ id: 'chats',        label: 'Чаты',              href: '/chats',               icon: 'chat',    section: 'comm',   primary: false },
		{ id: 'notifications',label: 'Уведомления',       href: '/notifications',       icon: 'bell',    section: 'comm',   primary: false },

		{ id: 'favorites',    label: 'Избранные',         href: '/dashboard/actors?favorites=true', icon: 'heart', section: 'saved', primary: false },

		{ id: 'settings',     label: 'Настройки',         href: '/settings',            icon: 'settings',section: 'system', primary: false },
		{ id: 'logout',       label: 'Выйти',             href: '/login',               icon: 'logout',  section: 'system', primary: false },
	],

	// ── 4. Агент ─────────────────────────────────────────────
	agent: [
		{ id: 'me-page',      label: 'Моя страница',     href: '/me',                  icon: 'user',    section: 'me',     primary: false },

		{ id: 'my-actors',    label: 'Мои актёры',        href: '/cabinet',             icon: 'users',   section: 'work',   primary: true  },
		{ id: 'feed',         label: 'Лента кастингов',   href: '/cabinet/feed',        icon: 'film',    section: 'work',   primary: true  },
		{ id: 'responses',    label: 'Мои отклики',       href: '/cabinet/responses',   icon: 'send',    section: 'work',   primary: false },

		{ id: 'chats',        label: 'Чаты',              href: '/chats',               icon: 'chat',    section: 'comm',   primary: false },
		{ id: 'notifications',label: 'Уведомления',       href: '/notifications',       icon: 'bell',    section: 'comm',   primary: false },

		{ id: 'settings',     label: 'Настройки',         href: '/settings',            icon: 'settings',section: 'system', primary: false },
		{ id: 'logout',       label: 'Выйти',             href: '/login',               icon: 'logout',  section: 'system', primary: false },
	],

	// ── 5. Актёр (user) ──────────────────────────────────────
	user: [
		{ id: 'my-card',      label: 'Моя анкета',        href: '/cabinet',             icon: 'user',    section: 'me',     primary: true  },
		{ id: 'feed',         label: 'Кастинги',          href: '/cabinet/feed',        icon: 'film',    section: 'work',   primary: true  },
		{ id: 'portfolio',    label: 'Портфолио',         href: '/cabinet/portfolio',   icon: 'portfolio',section: 'work',  primary: false },

		{ id: 'chats',        label: 'Чаты',              href: '/chats',               icon: 'chat',    section: 'comm',   primary: false },
		{ id: 'notifications',label: 'Уведомления',       href: '/notifications',       icon: 'bell',    section: 'comm',   primary: false },

		{ id: 'settings',     label: 'Настройки',         href: '/settings',            icon: 'settings',section: 'system', primary: false },
		{ id: 'logout',       label: 'Выйти',             href: '/login',               icon: 'logout',  section: 'system', primary: false },
	],
}

export function getNavItems(role: AppRole): NavItem[] {
	if (!role) return []
	return NAV_BY_ROLE[role] ?? NAV_BY_ROLE['employer'] ?? []
}

export function getPrimaryNavItems(role: AppRole): NavItem[] {
	return getNavItems(role).filter(i => i.primary)
}

export function getNavItemsBySection(role: AppRole): Array<{ section: NavSectionDef; items: NavItem[] }> {
	const items = getNavItems(role).filter(i => i.icon !== 'logout')
	return NAV_SECTIONS
		.map(section => ({
			section,
			items: items.filter(i => i.section === section.id),
		}))
		.filter(g => g.items.length > 0)
}

// Страницы без навигации
export const NO_NAV_PATHS = [
	'/login',
	'/admin-login',
	'/report',
	'/invite',
	'/alert',
	'/error',
]

export function shouldShowNav(pathname: string): boolean {
	if (!pathname) return false
	// точные совпадения с корнем раздела
	if (pathname === '/') return false
	return !NO_NAV_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}
