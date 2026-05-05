'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconBell,
	IconLoader,
	IconCheck,
} from '~packages/ui/icons'
import PushSettings from '~/widgets/push-settings/push-settings'
import styles from './notifications.module.scss'

interface Notification {
	id: number
	type: string
	channel: string
	title: string
	message?: string | null
	is_read: boolean
	casting_id?: number | null
	created_at: string
}

interface ListResponse {
	notifications: Notification[]
	total: number
	unread_count: number
}

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
	new_response:          { label: 'Новый отклик',     cls: 'tagPrimary' },
	status_change:         { label: 'Статус',           cls: 'tagWarn'    },
	casting_published:     { label: 'Публикация',       cls: 'tagInfo'    },
	casting_closed:        { label: 'Закрыт',           cls: 'tagMuted'   },
	profile_viewed:        { label: 'Просмотр',         cls: 'tagInfo'    },
	shortlist_added:       { label: 'Шорт-лист',        cls: 'tagInfo'    },
	subscription_purchased:{ label: 'Подписка',         cls: 'tagOk'      },
	system:                { label: 'Система',          cls: 'tagMuted'   },
}

function formatTime(raw?: string): string {
	if (!raw) return ''
	try {
		const d = new Date(raw)
		if (isNaN(d.getTime())) return raw.split('T')[0] || raw
		const now = new Date()
		const diff = (now.getTime() - d.getTime()) / 1000
		if (diff < 60)     return 'только что'
		if (diff < 3600)   return `${Math.floor(diff / 60)} мин назад`
		if (diff < 86400)  return `${Math.floor(diff / 3600)} ч назад`
		if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
	} catch { return raw }
}

export default function NotificationsPage() {
	const router = useRouter()
	const goBack = useSmartBack()
	const [items, setItems] = useState<Notification[]>([])
	const [unread, setUnread] = useState(0)
	const [loading, setLoading] = useState(true)
	const [filter, setFilter] = useState<'all' | 'unread'>('all')
	const [marking, setMarking] = useState(false)

	const load = useCallback(async (mode: 'all' | 'unread') => {
		setLoading(true)
		const qs = mode === 'unread' ? '?unread_only=true' : ''
		const data: ListResponse | null = await apiCall('GET', `notifications/${qs}`)
		if (data && !('detail' in (data as any))) {
			setItems(data.notifications || [])
			setUnread(data.unread_count || 0)
		}
		setLoading(false)
	}, [])

	useEffect(() => { load(filter) }, [filter, load])

	const markAll = async () => {
		if (marking || unread === 0) return
		setMarking(true)
		await apiCall('POST', 'notifications/read/')
		await load(filter)
		setMarking(false)
	}

	const onClickItem = async (n: Notification) => {
		if (!n.is_read) {
			await apiCall('POST', `notifications/read/?notification_id=${n.id}`)
			setItems(prev => prev.map(p => p.id === n.id ? { ...p, is_read: true } : p))
			setUnread(u => Math.max(0, u - 1))
		}
		if (n.casting_id) {
			router.push(`/dashboard/castings/${n.casting_id}`)
		}
	}

	const grouped = useMemo(() => {
		const today:    Notification[] = []
		const earlier:  Notification[] = []
		const now = new Date()
		for (const n of items) {
			const d = new Date(n.created_at)
			if (!isNaN(d.getTime()) && d.toDateString() === now.toDateString()) today.push(n)
			else earlier.push(n)
		}
		return { today, earlier }
	}, [items])

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Уведомления</h1>
				{unread > 0 && <span className={styles.badgeUnread}>{unread}</span>}
			</header>

			<div className={styles.toolbar}>
				<div className={styles.tabs}>
					<button
						className={`${styles.tab} ${filter === 'all' ? styles.tabActive : ''}`}
						onClick={() => setFilter('all')}
					>Все</button>
					<button
						className={`${styles.tab} ${filter === 'unread' ? styles.tabActive : ''}`}
						onClick={() => setFilter('unread')}
					>Непрочитанные{unread ? ` · ${unread}` : ''}</button>
				</div>

				<button
					className={styles.markAllBtn}
					onClick={markAll}
					disabled={marking || unread === 0}
				>
					<IconCheck size={14} />
					<span>Прочитать всё</span>
				</button>
			</div>

			<PushSettings />

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} />
					<span>Загрузка…</span>
				</div>
			) : items.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconBell size={34} /></div>
					<h3>Пока нет уведомлений</h3>
					<p>Здесь будут появляться новые отклики на ваши кастинги,
					действия по актёрам в отчётах и другие важные события.</p>
				</div>
			) : (
				<div className={styles.list}>
					{grouped.today.length > 0 && (
						<>
							<p className={styles.groupTitle}>Сегодня</p>
							{grouped.today.map(n => (
								<NotifRow key={n.id} item={n} onClick={() => onClickItem(n)} />
							))}
						</>
					)}
					{grouped.earlier.length > 0 && (
						<>
							<p className={styles.groupTitle}>Ранее</p>
							{grouped.earlier.map(n => (
								<NotifRow key={n.id} item={n} onClick={() => onClickItem(n)} />
							))}
						</>
					)}
				</div>
			)}
		</div>
	)
}

function NotifRow({ item, onClick }: { item: Notification; onClick: () => void }) {
	const tag = TYPE_LABELS[item.type] ?? { label: item.type, cls: 'tagMuted' }
	return (
		<button
			className={`${styles.row} ${item.is_read ? '' : styles.rowUnread}`}
			onClick={onClick}
		>
			<div className={styles.rowIcon}><IconBell size={18} /></div>
			<div className={styles.rowBody}>
				<div className={styles.rowHead}>
					<span className={`${styles.tag} ${styles[tag.cls]}`}>{tag.label}</span>
					<span className={styles.rowTime}>{formatTime(item.created_at)}</span>
				</div>
				<p className={styles.rowTitle}>{item.title}</p>
				{item.message && <p className={styles.rowMsg}>{item.message}</p>}
			</div>
			{!item.is_read && <span className={styles.unreadDot} />}
		</button>
	)
}
