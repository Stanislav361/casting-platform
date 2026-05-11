'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconBriefcase,
	IconChevronRight,
	IconFilm,
	IconHeart,
	IconLoader,
	IconReport,
	IconUsers,
} from '~packages/ui/icons'
import styles from './workspace.module.scss'

interface TeamWorkspaceItem {
	id: number
	title: string
	description?: string | null
	owner_id?: number | null
	owner_name?: string | null
	membership_role?: string | null
	sub_castings_count?: number
	team_size?: number
	response_count?: number
	report_count?: number
}

interface TeamWorkspaceResponse {
	role?: string
	is_team_member?: boolean
	teams?: TeamWorkspaceItem[]
	total?: number
}

const membershipLabel = (role?: string | null) => {
	if (role === 'owner') return 'Владелец'
	if (role === 'viewer') return 'Участник'
	if (role === 'editor') return 'Редактор'
	return 'Админ команды'
}

export default function TeamWorkspacePage() {
	const router = useRouter()
	const goBack = useSmartBack('/dashboard')
	const [data, setData] = useState<TeamWorkspaceResponse | null>(null)
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		setLoading(true)
		const res = await apiCall('GET', 'employer/projects/team-workspace/')
		setData(res && !res.detail ? res : { teams: [], total: 0 })
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const teams = data?.teams || []
	if (loading) {
		return (
			<div className={styles.root}>
				<div className={styles.loadingState}>
					<IconLoader size={26} />
					<span>Открываем команду…</span>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<div className={styles.headerTitle}>
					<div className={styles.headerIcon}><IconBriefcase size={20} /></div>
					<div>
						<h1>Команда</h1>
						<p>Всё, что вам доступно</p>
					</div>
				</div>
			</header>

			<section className={styles.hero}>
				<div className={styles.heroBadge}>
					<IconBriefcase size={14} /> Вы в команде
				</div>
				<h2>Здесь ваша рабочая команда</h2>
				<p>
					Если Админ PRO добавил вас сюда, значит вы можете работать вместе с ним:
					смотреть кастинги, делать отчёты, искать актёров и сохранять избранных.
				</p>
			</section>

			<section className={styles.helpBox}>
				<h3>Что можно делать?</h3>
				<div className={styles.helpSteps}>
					<div><b>1</b><span>Открыть кастинги и работать с ними</span></div>
					<div><b>2</b><span>Создавать и смотреть отчёты</span></div>
					<div><b>3</b><span>Искать актёров в базе</span></div>
					<div><b>4</b><span>Добавлять актёров в избранное</span></div>
				</div>
			</section>

			<nav className={styles.quickGrid} aria-label="Командные разделы">
				<button onClick={() => router.push('/dashboard/castings')}>
					<IconFilm size={20} />
					<span>Открыть кастинги</span>
					<small>Создать, опубликовать, посмотреть отклики</small>
					<IconChevronRight size={16} />
				</button>
				<button onClick={() => router.push('/dashboard/reports')}>
					<IconReport size={20} />
					<span>Открыть отчёты</span>
					<small>Сделать отчёт и добавить актёров</small>
					<IconChevronRight size={16} />
				</button>
				<button onClick={() => router.push('/dashboard/actors')}>
					<IconUsers size={20} />
					<span>Найти актёра</span>
					<small>Поиск по базе актёров</small>
					<IconChevronRight size={16} />
				</button>
				<button onClick={() => router.push('/dashboard/actors?favorites=true')}>
					<IconHeart size={20} />
					<span>Избранные</span>
					<small>Актёры, которых вы сохранили</small>
					<IconChevronRight size={16} />
				</button>
			</nav>

			<section className={styles.teamList}>
				<h3>Кто добавил вас в команду</h3>
				{teams.length === 0 ? (
					<div className={styles.empty}>
						<IconBriefcase size={32} />
						<b>Вас пока не добавили</b>
						<p>Когда Админ PRO добавит вас в команду, здесь появится доступ.</p>
					</div>
				) : (
					teams.map((team) => (
						<article key={team.id} className={styles.teamCard}>
							<div className={styles.teamTop}>
								<div>
									<span className={styles.rolePill}>{membershipLabel(team.membership_role)}</span>
									<h4>{team.owner_name || team.title}</h4>
									<p>Вы можете работать с его кастингами и отчётами</p>
								</div>
								<button onClick={() => router.push('/dashboard/castings')}>
									К кастингам <IconChevronRight size={14} />
								</button>
							</div>
							<div className={styles.teamMeta}>
								<span>{team.sub_castings_count || 0} кастингов</span>
								<span>{team.report_count || 0} отчётов</span>
								<span>{team.response_count || 0} откликов</span>
							</div>
						</article>
					))
				)}
			</section>
		</div>
	)
}
