import type { AppRole } from './use-role'

export interface NavItem {
	id: string
	label: string
	href: string
	icon: string   // имя иконки из набора
	primary?: boolean  // показывать в мобильном нижнем баре
}

export interface NavSection {
	items: NavItem[]
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
	owner: [
		{ id: 'dashboard',   label: 'Главная',       href: '/dashboard',          icon: 'home',       primary: true },
		{ id: 'projects',    label: 'Проекты',        href: '/dashboard',          icon: 'folder',     primary: true },
		{ id: 'actors',      label: 'База актёров',   href: '/dashboard/actors',   icon: 'users',      primary: true },
		{ id: 'admin',       label: 'Пользователи',   href: '/dashboard/admin',    icon: 'shield',     primary: false },
		{ id: 'favorites',   label: 'Избранные',      href: '/dashboard/actors?favorites=true', icon: 'heart', primary: false },
		{ id: 'logout',      label: 'Выйти',          href: '/login',              icon: 'logout',     primary: false },
	],
	employer_pro: [
		{ id: 'dashboard',   label: 'Главная',       href: '/dashboard',          icon: 'home',       primary: true },
		{ id: 'projects',    label: 'Проекты',        href: '/dashboard',          icon: 'folder',     primary: true },
		{ id: 'actors',      label: 'База актёров',   href: '/dashboard/actors',   icon: 'users',      primary: true },
		{ id: 'favorites',   label: 'Избранные',      href: '/dashboard/actors?favorites=true', icon: 'heart', primary: true },
		{ id: 'logout',      label: 'Выйти',          href: '/login',              icon: 'logout',     primary: false },
	],
	employer: [
		{ id: 'dashboard',   label: 'Главная',       href: '/dashboard',          icon: 'home',       primary: true },
		{ id: 'projects',    label: 'Мои проекты',    href: '/dashboard',          icon: 'folder',     primary: true },
		{ id: 'favorites',   label: 'Избранные',      href: '/dashboard/actors?favorites=true', icon: 'heart', primary: false },
		{ id: 'logout',      label: 'Выйти',          href: '/login',              icon: 'logout',     primary: false },
	],
	administrator: [
		{ id: 'dashboard',   label: 'Главная',       href: '/dashboard',          icon: 'home',       primary: true },
		{ id: 'projects',    label: 'Проекты',        href: '/dashboard',          icon: 'folder',     primary: true },
		{ id: 'actors',      label: 'База актёров',   href: '/dashboard/actors',   icon: 'users',      primary: true },
		{ id: 'favorites',   label: 'Избранные',      href: '/dashboard/actors?favorites=true', icon: 'heart', primary: false },
		{ id: 'logout',      label: 'Выйти',          href: '/login',              icon: 'logout',     primary: false },
	],
	manager: [
		{ id: 'dashboard',   label: 'Главная',       href: '/dashboard',          icon: 'home',       primary: true },
		{ id: 'projects',    label: 'Проекты',        href: '/dashboard',          icon: 'folder',     primary: true },
		{ id: 'favorites',   label: 'Избранные',      href: '/dashboard/actors?favorites=true', icon: 'heart', primary: false },
		{ id: 'logout',      label: 'Выйти',          href: '/login',              icon: 'logout',     primary: false },
	],
	agent: [
		{ id: 'cabinet',     label: 'Мои актёры',    href: '/cabinet',            icon: 'users',      primary: true },
		{ id: 'feed',        label: 'Лента',          href: '/cabinet/feed',       icon: 'film',       primary: true },
		{ id: 'logout',      label: 'Выйти',          href: '/login',              icon: 'logout',     primary: false },
	],
	user: [
		{ id: 'cabinet',     label: 'Моя анкета',    href: '/cabinet',            icon: 'user',       primary: true },
		{ id: 'feed',        label: 'Кастинги',       href: '/cabinet/feed',       icon: 'film',       primary: true },
		{ id: 'logout',      label: 'Выйти',          href: '/login',              icon: 'logout',     primary: false },
	],
}

export function getNavItems(role: AppRole): NavItem[] {
	if (!role) return []
	return NAV_BY_ROLE[role] ?? NAV_BY_ROLE['employer'] ?? []
}

export function getPrimaryNavItems(role: AppRole): NavItem[] {
	return getNavItems(role).filter(i => i.primary)
}

// Страницы без навигации
export const NO_NAV_PATHS = [
	'/login',
	'/admin',
	'/admin-login',
	'/report',
	'/invite',
	'/alert',
	'/error',
]

export function shouldShowNav(pathname: string): boolean {
	return !NO_NAV_PATHS.some(p => pathname.startsWith(p))
}
