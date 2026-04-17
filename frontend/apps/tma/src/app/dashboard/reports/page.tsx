'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import {
	IconArrowLeft,
	IconReport,
	IconLoader,
	IconChevronRight,
	IconSearch,
	IconEye,
	IconGlobe,
	IconFolder,
} from '~packages/ui/icons'
import styles from './reports.module.scss'

interface ReportItem {
	id: number
	title: string
	casting_id: number
	public_id?: string | null
	created_at: string
}

function formatDate(raw?: string): string {
	if (!raw) return ''
	try {
		const d = new Date(raw)
		if (isNaN(d.getTime())) return raw.split('T')[0] || raw
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
	} catch {
		return raw
	}
}

export default function ReportsPage() {
	const router = useRouter()
	const [reports, setReports] = useState<ReportItem[]>([])
	const [loading, setLoading] = useState(true)
	const [query,   setQuery]   = useState('')

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'employer/reports/')
		setReports(data?.reports || [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const filtered = reports.filter(r => {
		if (!query) return true
		const q = query.toLowerCase()
		return (r.title || '').toLowerCase().includes(q)
	})

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Отчёты</h1>
				<span className={styles.headerBadge}>{reports.length}</span>
			</div>

			<div className={styles.toolbar}>
				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						className={styles.searchInput}
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="Поиск по названию отчёта..."
					/>
				</div>
			</div>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка отчётов…
				</div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconReport size={28} /></div>
					<h3>Отчётов пока нет</h3>
					<p>Отчёты создаются из карточки кастинга — там вы собираете шорт-лист актёров и делитесь им с заказчиком.</p>
					<button className={styles.emptyBtn} onClick={() => router.push('/dashboard')}>
						К проектам
					</button>
				</div>
			) : (
				<div className={styles.list}>
					{filtered.map(r => (
						<div key={r.id} className={styles.item}>
							<div className={styles.itemIcon}>
								<IconReport size={18} />
							</div>
							<div className={styles.itemMain}>
								<p className={styles.itemTitle}>{r.title || 'Отчёт без названия'}</p>
								<div className={styles.itemMeta}>
									<span>Создан: {formatDate(r.created_at)}</span>
									{r.public_id && (
										<span className={styles.itemMetaDot}>Публичная ссылка</span>
									)}
								</div>
							</div>
							<div className={styles.itemActions}>
								<button
									className={styles.actionBtn}
									onClick={() => window.open(`/report/${r.public_id}`, '_blank')}
									disabled={!r.public_id}
									title="Открыть отчёт"
								>
									<IconEye size={14} />
									<span>Отчёт</span>
								</button>
								<button
									className={styles.actionBtn}
									onClick={() => {
										if (!r.public_id) return
										const url = `${window.location.origin}/report/${r.public_id}`
										navigator.clipboard.writeText(url).then(() => {
											alert('Ссылка на отчёт скопирована!')
										}).catch(() => {
											prompt('Скопируйте ссылку:', url)
										})
									}}
									disabled={!r.public_id}
									title="Скопировать ссылку на отчёт"
								>
									<IconGlobe size={14} />
									<span>Ссылка</span>
								</button>
								<button
									className={styles.actionBtn}
									onClick={() => router.push(`/dashboard/project/${r.casting_id}`)}
									title="Перейти к проекту"
								>
									<IconFolder size={14} />
									<span>Проект</span>
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
