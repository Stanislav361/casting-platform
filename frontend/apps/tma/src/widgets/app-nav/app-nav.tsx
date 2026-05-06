'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import { logout as doLogout } from '@prostoprobuy/models'
import { useRole } from '~/shared/use-role'
import { apiCall } from '~/shared/api-client'
import { getNavItems, getPrimaryNavItems, getNavItemsBySection, shouldShowNav, type NavItem } from '~/shared/nav-config'
import {
	IconHome,
	IconFolder,
	IconUsers,
	IconHeart,
	IconFilm,
	IconUser,
	IconShield,
	IconSettings,
	IconLogOut,
	IconChevronRight,
	IconX,
	IconChat,
	IconBell,
	IconReport,
	IconSend,
	IconCamera,
	IconPortfolio,
	IconPlus,
	IconMessageSquare,
} from '~packages/ui/icons'
import SupportChat from '~/widgets/support-chat/support-chat'
import PushMiniControl from '~/widgets/push-mini-control/push-mini-control'
import styles from './app-nav.module.scss'

const ICON_MAP: Record<string, React.ReactNode> = {
	home:      <IconHome size={20} />,
	folder:    <IconFolder size={20} />,
	users:     <IconUsers size={20} />,
	heart:     <IconHeart size={20} />,
	film:      <IconFilm size={20} />,
	user:      <IconUser size={20} />,
	shield:    <IconShield size={20} />,
	settings:  <IconSettings size={20} />,
	logout:    <IconLogOut size={20} />,
	chat:      <IconChat size={20} />,
	bell:      <IconBell size={20} />,
	report:    <IconReport size={20} />,
	send:      <IconSend size={20} />,
	camera:    <IconCamera size={20} />,
	portfolio: <IconPortfolio size={20} />,
	plus:      <IconPlus size={20} />,
	support:   <IconMessageSquare size={20} />,
}

function NavIcon({ name }: { name: string }) {
	return <>{ICON_MAP[name] ?? <IconHome size={20} />}</>
}

function isActive(href: string, pathname: string, searchString: string): boolean {
	const [hPath, hQuery] = href.split('?')
	if (hQuery) {
		if (pathname !== hPath) return false
		const current = (searchString || '').replace(/^\?/, '')
		return hQuery.split('&').every(kv => current.split('&').includes(kv))
	}
	// /dashboard and /actor-home are hub pages — only active on exact match
	if (hPath === '/dashboard') return pathname === '/dashboard'
	if (hPath === '/actor-home') return pathname === '/actor-home'
	if (pathname.startsWith(hPath)) return true
	return false
}

export default function AppNav() {
	const pathname = usePathname()
	const router   = useRouter()
	const role     = useRole()
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [supportOpen, setSupportOpen] = useState(false)
	const [unreadCount, setUnreadCount] = useState<number>(0)
	const [searchString, setSearchString] = useState<string>('')
	const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

	useEffect(() => {
		if (typeof window === 'undefined') return
		setSearchString(window.location.search.replace(/^\?/, ''))
	}, [pathname])

	const handleNav = useCallback((item: NavItem) => {
		setDrawerOpen(false)
		if (item.icon === 'logout') {
			doLogout()
			router.replace('/login')
			return
		}
		if (item.icon === 'support') {
			setSupportOpen(true)
			return
		}
		router.push(item.href)
	}, [router])

	// Подтягиваем непрочитанные уведомления для бейджа
	useEffect(() => {
		if (!role) return
		let cancelled = false
		const fetchUnread = async () => {
			try {
				const data = await apiCall('GET', 'notifications/?unread_only=true&page=1')
				if (!cancelled && data && !data.detail) {
					setUnreadCount(data.unread_count || 0)
				}
			} catch {}
		}
		fetchUnread()
		const t = setInterval(fetchUnread, 30000)
		// обновляем при смене роута (пользователь мог прочитать уведомления)
		return () => { cancelled = true; clearInterval(t) }
	}, [role, pathname])

	const getBadge = useCallback((item: NavItem): number => {
		if (item.badgeKey === 'unread') return unreadCount
		return 0
	}, [unreadCount])

	const isAnyChildActive = useCallback((item: NavItem): boolean => {
		if (!item.children) return false
		return item.children.some(c => isActive(c.href, pathname, searchString))
	}, [pathname, searchString])

	// Авто-раскрытие родителя, если активен любой дочерний пункт
	useEffect(() => {
		if (!role) return
		const items = getNavItems(role)
		setExpandedItems(prev => {
			const next = { ...prev }
			items.forEach(item => {
				if (item.children && isAnyChildActive(item) && !next[item.id]) {
					next[item.id] = true
				}
			})
			return next
		})
	}, [role, pathname, searchString, isAnyChildActive])

	const toggleExpanded = useCallback((id: string) => {
		setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
	}, [])

	if (!shouldShowNav(pathname) || !role) return null

	const allItems     = getNavItems(role)
	const primaryItems = getPrimaryNavItems(role)
	const sections     = getNavItemsBySection(role)
	const drawerSections = sections
		.map(({ section, items }) => ({
			section,
			items: items.filter(item => !item.primary),
		}))
		.filter(group => group.items.length > 0)
	const logoutItem   = allItems.find(i => i.icon === 'logout')

	const roleLabel: Record<string, string> = {
		owner: 'Супер Админ',
		employer_pro: 'Админ PRO',
		employer: 'Работодатель',
		administrator: 'Администратор',
		manager: 'Менеджер',
		agent: 'Агент',
		user: 'Актёр',
	}

	return (
		<>
			{/* ── Desktop sidebar ─────────────────────────────── */}
			<aside className={styles.sidebar}>
				<div className={styles.sidebarLogo}>
					<span className={styles.logoMark}>P</span>
					<span className={styles.logoText}>prostoprobuy</span>
				</div>

				<div className={styles.sidebarRole}>
					<span className={styles.roleBadge}>{roleLabel[role] ?? role}</span>
				</div>

				<nav className={styles.sidebarNav}>
					{sections.map(({ section, items }) => (
						<div key={section.id} className={styles.sidebarSection}>
							<p className={styles.sidebarSectionTitle}>{section.title}</p>
							{items.map(item => {
								const badge = getBadge(item)
								const hasChildren = !!(item.children && item.children.length > 0)
								const parentActive = isActive(item.href, pathname, searchString) || isAnyChildActive(item)
								const isOpen = hasChildren && !!expandedItems[item.id]

								return (
									<div key={item.id} className={styles.sidebarItemGroup}>
										<button
											className={`${styles.sidebarItem} ${parentActive ? styles.sidebarItemActive : ''}`}
											onClick={() => {
												if (hasChildren) {
													toggleExpanded(item.id)
													// Дополнительно переходим на href родителя при первом открытии
													if (!isOpen && !isActive(item.href, pathname, searchString)) {
														router.push(item.href)
													}
												} else {
													handleNav(item)
												}
											}}
										>
											<span className={styles.sidebarItemIcon}><NavIcon name={item.icon} /></span>
											<span className={styles.sidebarItemLabel}>{item.label}</span>
											{badge > 0 && (
												<span className={styles.badgeCount}>{badge > 99 ? '99+' : badge}</span>
											)}
											{hasChildren && (
												<span className={`${styles.sidebarChevron} ${isOpen ? styles.sidebarChevronOpen : ''}`}>
													<IconChevronRight size={14} />
												</span>
											)}
											{!hasChildren && isActive(item.href, pathname, searchString) && badge === 0 && (
												<span className={styles.sidebarItemDot} />
											)}
										</button>

										{hasChildren && isOpen && (
											<div className={styles.sidebarSubmenu}>
												{item.children!.map(child => {
													const childBadge = getBadge(child)
													const childActive = isActive(child.href, pathname, searchString)
													return (
														<button
															key={child.id}
															className={`${styles.sidebarSubItem} ${childActive ? styles.sidebarSubItemActive : ''}`}
															onClick={() => handleNav(child)}
														>
															<span className={styles.sidebarSubItemBullet} />
															<span className={styles.sidebarSubItemIcon}><NavIcon name={child.icon} /></span>
															<span className={styles.sidebarItemLabel}>{child.label}</span>
															{childBadge > 0 && (
																<span className={styles.badgeCount}>{childBadge > 99 ? '99+' : childBadge}</span>
															)}
														</button>
													)
												})}
											</div>
										)}
									</div>
								)
							})}
						</div>
					))}
				</nav>

				<div className={styles.sidebarBottom}>
					{logoutItem && (
						<button className={styles.sidebarLogout} onClick={() => handleNav(logoutItem)}>
							<IconLogOut size={16} />
							<span>Выйти</span>
						</button>
					)}
				</div>
			</aside>

	{/* ── Mobile: bottom bar ──────────────────────────── */}
	{/* Бар полностью убран: все роли теперь используют хаб-страницы
		(/dashboard для admin, /actor-home для actor/agent) */}

	{/* ── Support chat ────────────────────────────────── */}
	<SupportChat open={supportOpen} onClose={() => setSupportOpen(false)} />

			{/* ── Mobile drawer ───────────────────────────────── */}
			{drawerOpen && (
				<div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)}>
					<div className={styles.drawer} onClick={e => e.stopPropagation()}>
						<div className={styles.drawerHeader}>
							<div className={styles.drawerHeaderInfo}>
								<span className={styles.drawerLogoMark}>P</span>
								<div>
									<p className={styles.drawerAppName}>prostoprobuy</p>
									<p className={styles.drawerRole}>{roleLabel[role] ?? role}</p>
								</div>
							</div>
							<button className={styles.drawerClose} onClick={() => setDrawerOpen(false)}>
								<IconX size={18} />
							</button>
						</div>

					<div className={styles.drawerBody}>
						<PushMiniControl />
						{drawerSections.map(({ section, items }) => (
								<div key={section.id} className={styles.drawerGroup}>
									<p className={styles.drawerSection}>{section.title}</p>
									{items.map((item, index) => {
										const badge = getBadge(item)
										const hasChildren = !!(item.children && item.children.length > 0)
										const isPremiumItem = ['actors', 'castings', 'notifications'].includes(item.id)
										const isOpen = hasChildren && !!expandedItems[item.id]
										const parentActive = isActive(item.href, pathname, searchString) || isAnyChildActive(item)

										return (
											<div key={item.id} className={styles.drawerItemGroup}>
												<button
													className={`${styles.drawerItem} ${parentActive ? styles.drawerItemActive : ''}`}
													onClick={() => {
														if (hasChildren) {
															toggleExpanded(item.id)
														} else {
															handleNav(item)
														}
													}}
													data-tier={isPremiumItem ? 'premium' : 'standard'}
													style={{ animationDelay: `${0.1 + index * 0.05}s` }}
												>
													<span className={styles.drawerItemIcon}><NavIcon name={item.icon} /></span>
													<span className={styles.drawerItemLabel}>{item.label}</span>
													{badge > 0 && (
														<span className={styles.badgeCount}>{badge > 99 ? '99+' : badge}</span>
													)}
													<span className={`${styles.drawerChevron} ${isOpen ? styles.drawerChevronOpen : ''}`}>
														<IconChevronRight size={14} />
													</span>
												</button>

												{hasChildren && isOpen && (
													<div className={styles.drawerSubmenu}>
														{item.children!.map((child, ci) => {
															const childBadge = getBadge(child)
															const childActive = isActive(child.href, pathname, searchString)
															return (
																<button
																	key={child.id}
																	className={`${styles.drawerSubItem} ${childActive ? styles.drawerSubItemActive : ''}`}
																	style={{ animationDelay: `${ci * 0.04}s` }}
																	onClick={() => handleNav(child)}
																>
																	<span className={styles.drawerSubItemDot} />
																	<span className={styles.drawerSubItemIcon}><NavIcon name={child.icon} /></span>
																	<span className={styles.drawerSubItemLabel}>{child.label}</span>
																	{childBadge > 0 && (
																		<span className={styles.badgeCount}>{childBadge > 99 ? '99+' : childBadge}</span>
																	)}
																</button>
															)
														})}
													</div>
												)}
											</div>
										)
									})}
						</div>
						))}
					</div>

						<div className={styles.drawerFooter}>
							{logoutItem && (
								<button className={styles.drawerLogout} onClick={() => handleNav(logoutItem)}>
									<IconLogOut size={16} />
									Выйти из аккаунта
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
