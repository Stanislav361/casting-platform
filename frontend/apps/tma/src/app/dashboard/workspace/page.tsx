'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
	const totals = useMemo(() => {
		return teams.reduce(
			(acc, team) => {
				acc.castings += team.sub_castings_count || 0
				acc.reports += team.report_count || 0
				acc.responses += team.response_count || 0
				return acc
			},
			{ castings: 0, reports: 0, responses: 0 },
		)
	}, [teams])

	if (loading) {
		return (
			<div className={styles.root}>
				<div className={styles.loadingState}>
					<IconLoader size={26} />
					<span>Загружаем профиль команды…</span>
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
						<h1>Профиль команды</h1>
						<p>Рабочее пространство кастингов, отчётов и базы актёров</p>
					</div>
				</div>
			</header>

			<section className={styles.hero}>
				<div className={styles.heroBadge}>
					<IconBriefcase size={14} /> Полный командный доступ
				</div>
				<h2>Здесь собраны все команды, куда вы добавлены</h2>
				<p>
					Внутри команды доступны кастинги, отчёты, база актёров и избранные.
					Вы можете публиковать кастинги, формировать отчёты и сохранять актёров.
				</p>
				<div className={styles.stats}>
					<div><b>{teams.length}</b><span>команд</span></div>
					<div><b>{totals.castings}</b><span>кастингов</span></div>
					<div><b>{totals.reports}</b><span>отчётов</span></div>
					<div><b>{totals.responses}</b><span>откликов</span></div>
				</div>
			</section>

			<nav className={styles.quickGrid} aria-label="Командные разделы">
				<button onClick={() => router.push('/dashboard/castings')}>
					<IconFilm size={20} />
					<span>Кастинги</span>
					<small>Создание, публикация, отклики</small>
					<IconChevronRight size={16} />
				</button>
				<button onClick={() => router.push('/dashboard/reports')}>
					<IconReport size={20} />
					<span>Отчёты</span>
					<small>Создать, открыть, пополнить</small>
					<IconChevronRight size={16} />
				</button>
				<button onClick={() => router.push('/dashboard/actors')}>
					<IconUsers size={20} />
					<span>База актёров</span>
					<small>Поиск по всей базе</small>
					<IconChevronRight size={16} />
				</button>
				<button onClick={() => router.push('/dashboard/actors?favorites=true')}>
					<IconHeart size={20} />
					<span>Избранные</span>
					<small>Сохранённые актёры</small>
					<IconChevronRight size={16} />
				</button>
			</nav>

			<section className={styles.teamList}>
				<h3>Мои команды</h3>
				{teams.length === 0 ? (
					<div className={styles.empty}>
						<IconBriefcase size={32} />
						<b>Пока нет команд</b>
						<p>Когда Админ PRO добавит вас в команду, здесь появится рабочее пространство.</p>
					</div>
				) : (
					teams.map((team) => (
						<article key={team.id} className={styles.teamCard}>
							<div className={styles.teamTop}>
								<div>
									<span className={styles.rolePill}>{membershipLabel(team.membership_role)}</span>
									<h4>{team.title}</h4>
									{team.owner_name && <p>Владелец: {team.owner_name}</p>}
								</div>
								<button onClick={() => router.push(`/dashboard/castings/${team.id}`)}>
									Открыть <IconChevronRight size={14} />
								</button>
							</div>
							<div className={styles.teamMeta}>
								<span>{team.team_size || 1} в команде</span>
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
