'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useRole, canManageTeam } from '~/shared/use-role'
import { useSmartBack } from '~/shared/smart-back'
import { useDialog } from '~/shared/dialog/dialog-provider'
import {
	IconArrowLeft,
	IconUsers,
	IconLoader,
	IconUser,
	IconMail,
	IconTelegram,
	IconPlus,
	IconX,
	IconDiamond,
	IconEye,
	IconTrash,
} from '~packages/ui/icons'
import styles from './team.module.scss'

interface Collaborator {
	id: number
	user_id: number
	email?: string
	telegram_username?: string | null
	telegram_nick?: string | null
	first_name?: string | null
	last_name?: string | null
	photo_url?: string | null
	user_role?: string | null
	role?: string
}

const ROLE_LABEL: Record<string, string> = {
	editor: 'Редактор',
	viewer: 'Наблюдатель',
	owner: 'Владелец',
}

function getAddMemberError(res: any) {
	const detail = res?.detail
	if (typeof detail === 'string') return detail
	if (Array.isArray(detail)) {
		const firstMessage = detail
			.map((item: any) => item?.msg || item?.message)
			.find(Boolean)
		if (firstMessage) return String(firstMessage)
	}
	if (typeof res?.error === 'string') return res.error
	return 'Не удалось добавить участника. Проверьте email, Telegram username и права доступа.'
}

export default function TeamPage() {
	const router = useRouter()
	const goBack = useSmartBack('/dashboard')
	const role = useRole()
	const dialog = useDialog()
	const [members, setMembers] = useState<Collaborator[]>([])
	const [loading, setLoading] = useState(true)
	const [removingId, setRemovingId] = useState<number | null>(null)
	const [addModal, setAddModal] = useState(false)
	const [addIdentifier, setAddIdentifier] = useState('')
	const [addLoading, setAddLoading] = useState(false)
	const [addError, setAddError] = useState<string | null>(null)

	const isOwner = role === 'owner'
	// Регулярный Админ (employer) — соло-режим. Командная работа доступна только в Админ PRO.
	// Пока роль не определена (role === null), считаем что доступ есть, чтобы не моргать gate-экраном.
	const teamFeatureAvailable = role === null ? true : canManageTeam(role)

	const load = useCallback(async () => {
		if (!teamFeatureAvailable) {
			setLoading(false)
			return
		}
		setLoading(true)
		const data = await apiCall('GET', 'employer/projects/admin-team/')
		if (data && !data.detail) {
			setMembers(data.members || data.items || [])
		} else {
			setMembers([])
		}
		setLoading(false)
	}, [teamFeatureAvailable])

	useEffect(() => { load() }, [load])

	const openAddModal = useCallback(() => {
		setAddModal(true)
		setAddIdentifier('')
		setAddError(null)
	}, [])

	const closeAddModal = useCallback(() => {
		if (addLoading) return
		setAddModal(false)
		setAddIdentifier('')
		setAddError(null)
	}, [addLoading])

	const addTeamMember = useCallback(async () => {
		if (!addModal || !addIdentifier.trim() || addLoading) return
		setAddLoading(true)
		setAddError(null)
		const identifier = addIdentifier.trim()
		const res = await apiCall(
			'POST',
			`employer/projects/admin-team/?user_identifier=${encodeURIComponent(identifier)}&role=editor`,
			{ user_identifier: identifier },
		)
		setAddLoading(false)
		if (res?.ok) {
			await load()
			closeAddModal()
			return
		}
		setAddError(getAddMemberError(res))
	}, [addIdentifier, addLoading, addModal, closeAddModal, load])

	const getTelegramUsername = useCallback((member: Collaborator) => {
		const raw = member.telegram_nick || member.telegram_username || ''
		if (!raw) return ''
		return raw.startsWith('@') ? raw : `@${raw}`
	}, [])

	const openMemberProfile = useCallback((userId: number) => {
		router.push(`/cabinet/admin-profile/${userId}`)
	}, [router])

	const removeTeamMember = useCallback(async (member: Collaborator) => {
		if (removingId) return
		const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email || 'участника'
		const ok = await dialog.confirm({
			title: 'Убрать из команды?',
			message: `${name} больше не сможет работать с вашими кастингами, отчётами и избранным.`,
			confirmLabel: 'Убрать',
			cancelLabel: 'Отмена',
			tone: 'danger',
		})
		if (!ok) return

		setRemovingId(member.id)
		const res = await apiCall('DELETE', `employer/projects/admin-team/${member.id}/`)
		setRemovingId(null)
		if (res?.ok) {
			await load()
			return
		}
		dialog.error({
			title: 'Не получилось убрать',
			message: typeof res?.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
		})
	}, [dialog, load, removingId])

	if (!teamFeatureAvailable) {
		return (
			<div className={styles.root}>
				<div className={styles.header}>
					<button className={styles.backBtn} onClick={goBack}>
						<IconArrowLeft size={16} /> Назад
					</button>
					<h1 className={styles.headerTitle}>Моя команда</h1>
				</div>

				<div className={styles.gate}>
					<div className={styles.gateIcon}>
						<IconDiamond size={32} />
					</div>
					<h2 className={styles.gateTitle}>Командная работа — в Админ PRO</h2>
					<p className={styles.gateText}>
						Подписка <b>Админ кастинга</b> — это соло-режим: вы публикуете кастинги
						и работаете с откликами самостоятельно.
					</p>
					<p className={styles.gateText}>
						Чтобы подключать других админов к своим кастингам и вести их вместе —
						перейдите на <b>Админ PRO</b>.
					</p>
					<button
						className={styles.gateBtn}
						onClick={() => router.push('/login/role')}
					>
						<IconDiamond size={16} /> Перейти на Админ PRO
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Моя команда</h1>
				<span className={styles.headerBadge}>{members.length}</span>
			</div>

			<section className={styles.gate}>
				<div className={styles.gateIcon}>
					<IconUsers size={32} />
				</div>
				<h2 className={styles.gateTitle}>Здесь вы собираете свою команду</h2>
				<p className={styles.gateText}>
					Пригласите других админов — и они смогут работать с вашими кастингами,
					отчётами, актёрами и избранным. Как ваши помощники.
				</p>
				<p className={styles.gateText} style={{ fontSize: 13, opacity: 0.8 }}>
					Хотите наоборот — посмотреть команды, в которые <b>пригласили вас</b>?
					Откройте раздел <b>«Приглашения в команду»</b> в меню.
				</p>
				<button className={styles.gateBtn} onClick={openAddModal}>
					<IconPlus size={16} /> Пригласить в команду
				</button>
			</section>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка команды…
				</div>
			) : members.length === 0 ? (
				null
			) : (
				<div className={styles.list}>
					{members.map((m) => {
						const telegramUsername = getTelegramUsername(m)
						const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email || telegramUsername || `User #${m.user_id}`
						return (
							<div key={m.id} className={styles.card}>
								<div className={styles.teamList}>
									<ul className={styles.members}>
										<li className={styles.member}>
											<div className={styles.memberAvatar}>
												{m.photo_url ? <img src={m.photo_url} alt="" /> : <IconUser size={18} />}
											</div>
											<div className={styles.memberInfo}>
												<p className={styles.memberName}>{name}</p>
												{m.email && (
													<p className={styles.memberEmail}>
														<IconMail size={11} /> {m.email}
													</p>
												)}
												{telegramUsername && (
													<p className={styles.memberEmail}>
														<IconTelegram size={11} /> {telegramUsername}
													</p>
												)}
											</div>
											<span className={styles.roleTag}>{ROLE_LABEL[m.role || 'editor'] || 'Редактор'}</span>
										</li>
									</ul>
									<div className={styles.memberActions}>
										<button
											type="button"
											className={styles.profileBtn}
											onClick={() => openMemberProfile(m.user_id)}
										>
											<IconEye size={14} /> Профиль
										</button>
										<button
											type="button"
											className={styles.removeBtn}
											onClick={() => removeTeamMember(m)}
											disabled={removingId === m.id}
										>
											{removingId === m.id ? <IconLoader size={14} /> : <IconTrash size={14} />}
											Убрать
										</button>
									</div>
									<div className={styles.emptyTeam}>
										<p>Доступ: кастинги, отчёты, база актёров, избранные и публикация кастингов.</p>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}

			{addModal && (
				<div className={styles.modalOverlay} onClick={closeAddModal}>
					<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
					<div className={styles.modalHeader}>
						<div>
							<h3 className={styles.modalTitle}>
								<IconUsers size={18} /> Пригласить в команду
							</h3>
							<p className={styles.modalSubtitle}>Человек получит доступ ко всем вашим кастингам, отчётам и актёрам</p>
						</div>
							<button className={styles.modalClose} onClick={closeAddModal} disabled={addLoading}>
								<IconX size={16} />
							</button>
						</div>

						<div className={styles.modalBody}>
							<label className={styles.modalLabel} htmlFor="team-member-identifier">
								Email или Telegram username
							</label>
							<input
								id="team-member-identifier"
								className={styles.modalInput}
								value={addIdentifier}
								onChange={(e) => setAddIdentifier(e.target.value)}
								placeholder="user@example.com или @username"
								inputMode="text"
								autoComplete="off"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								disabled={addLoading}
								onKeyDown={(e) => {
									if (e.key === 'Enter') addTeamMember()
								}}
							/>
							<p className={styles.modalHint}>
								{isOwner
									? 'SuperAdmin может добавить пользователя с любой ролью.'
									: 'Можно добавить только Админа или Админа PRO. Пользователь должен быть зарегистрирован и иметь email или Telegram username.'}
							</p>
							{addError && <p className={styles.modalError}>{addError}</p>}
						</div>

						<div className={styles.modalActions}>
							<button className={styles.modalCancel} onClick={closeAddModal} disabled={addLoading}>
								Отмена
							</button>
							<button
								className={styles.modalSubmit}
								onClick={addTeamMember}
								disabled={addLoading || !addIdentifier.trim()}
							>
								{addLoading ? <IconLoader size={14} /> : <IconPlus size={14} />}
								Добавить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
