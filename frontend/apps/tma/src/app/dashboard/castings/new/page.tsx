'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useRole } from '~/shared/use-role'
import { useSmartBack } from '~/shared/smart-back'
import { useDialog } from '~/shared/dialog/dialog-provider'
import {
	IconArrowLeft,
	IconLoader,
	IconPlus,
} from '~packages/ui/icons'
import styles from './new-casting.module.scss'

interface CastingContainer {
	id: number
	title: string
	image_url: string | null
	status: string
}

const CATEGORIES = ['Полный метр', 'Короткий метр', 'Сериал', 'Клип', 'Реклама', 'Ролик', 'Другое']
const ROLE_TYPES = ['АМС', 'Групповка', 'Эпизодическая', 'Второго плана', 'Главная']
const GENDERS = ['Мужчина', 'Женщина', 'Мальчик', 'Девочка']

const DEFAULT_CONTAINER_TITLE = 'Мои кастинги'

/**
 * Возвращает id скрытого backend-контейнера текущего админа.
 * Backend пока требует этот id для создания кастинга, но в UI эта сущность не показывается.
 */
async function resolveDefaultProjectId(): Promise<number | null> {
	const data = await apiCall('GET', 'employer/projects/?page=1&page_size=200')
	if (data && !data.detail) {
		const list: CastingContainer[] = (data?.projects || data?.items || [])
			.filter((p: CastingContainer) => !p.status?.includes('archived'))
		if (list.length > 0) return list[0].id
	}
	const created = await apiCall('POST', 'employer/projects/', {
		title: DEFAULT_CONTAINER_TITLE,
		description: '',
	})
	if (created?.id) return created.id
	return null
}

export default function NewCastingPageWrapper() {
	return (
		<Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Загрузка...</div>}>
			<NewCastingPage />
		</Suspense>
	)
}

function NewCastingPage() {
	const router = useRouter()
	const role = useRole()
	const goBack = useSmartBack()
	const dialog = useDialog()

	useEffect(() => {
		if (role && !['owner', 'administrator', 'manager', 'employer_pro', 'employer'].includes(role)) {
			router.replace('/dashboard')
		}
	}, [role, router])

	const [title, setTitle] = useState('')
	const [city, setCity] = useState('')
	const [category, setCategory] = useState('')
	const [roleTypes, setRoleTypes] = useState<string[]>([])
	const [gender, setGender] = useState('')
	const [genderCustom, setGenderCustom] = useState('')
	const [ageFrom, setAgeFrom] = useState('')
	const [ageTo, setAgeTo] = useState('')
	const [finance, setFinance] = useState('')
	const [financeNegotiable, setFinanceNegotiable] = useState(false)
	const [shootDateFrom, setShootDateFrom] = useState('')
	const [shootDateTo, setShootDateTo] = useState('')
	const [description, setDescription] = useState('')
	const [creating, setCreating] = useState(false)
	const [savingDraft, setSavingDraft] = useState(false)

	const buildPayload = () => {
		const genderValue = gender === 'custom' ? genderCustom.trim() : gender
		const formatDateLabel = (value: string) => {
			const [year, month, day] = value.split('-')
			if (!year || !month || !day) return value
			return `${day}.${month}.${year}`
		}
		return {
			title: title.trim(),
			description: description.trim() || '-',
			city: city.trim() || undefined,
			project_category: category || undefined,
			role_types: roleTypes.length > 0 ? roleTypes : undefined,
			gender: genderValue || undefined,
			age_from: ageFrom ? parseInt(ageFrom, 10) : undefined,
			age_to: ageTo ? parseInt(ageTo, 10) : undefined,
			financial_conditions: financeNegotiable ? 'Обсуждаются индивидуально' : (finance.trim() || undefined),
			shooting_dates: (shootDateFrom && shootDateTo)
				? `${formatDateLabel(shootDateFrom)} - ${formatDateLabel(shootDateTo)}`
				: undefined,
		}
	}

	const createCasting = async (asDraft: boolean) => {
		if (asDraft) {
			if (!title.trim()) {
				dialog.warn({ title: 'Заполните название', message: 'Укажите название кастинга, чтобы сохранить черновик.' })
				return
			}
		} else {
			if (!title.trim()) return
			if (!shootDateFrom || !shootDateTo) return
			if (shootDateTo < shootDateFrom) {
				dialog.warn({
					title: 'Проверьте даты съёмок',
					message: 'Дата окончания не может быть раньше даты начала.',
				})
				return
			}
		}
		asDraft ? setSavingDraft(true) : setCreating(true)
		try {
			const projectId = await resolveDefaultProjectId()
			if (!projectId) {
				dialog.error({
					title: 'Не получилось подготовить кастинг',
					message: 'Попробуйте ещё раз через минуту.',
				})
				return
			}
			const payload: Record<string, any> = {
				...buildPayload(),
				status: asDraft ? 'unpublished' : 'published',
			}
			const res = await apiCall('POST', `employer/projects/${projectId}/castings/`, payload)
			if (res?.id) {
				router.replace(asDraft ? '/dashboard/castings' : `/dashboard/castings/${res.id}`)
				return
			}
			const msg = typeof res?.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.'
			dialog.error({ title: 'Не получилось создать кастинг', message: msg })
		} catch {
			dialog.error({ title: 'Нет связи', message: 'Проверьте интернет и попробуйте ещё раз.' })
		} finally {
			setSavingDraft(false)
			setCreating(false)
		}
	}

	const isValid = Boolean(
		title.trim() &&
		city.trim() &&
		category &&
		roleTypes.length > 0 &&
		gender && (gender !== 'custom' || genderCustom.trim()) &&
		(ageFrom || ageTo) &&
		(financeNegotiable || finance.trim()) &&
		shootDateFrom && shootDateTo &&
		description.trim(),
	)

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Новый кастинг</h1>
				<div style={{ width: 80 }} />
			</header>

			<div className={styles.content}>
				<section className={styles.section}>
					<label className={styles.label}>Заголовок <span className={styles.req}>*</span></label>
					<input
						value={title}
						onChange={e => setTitle(e.target.value)}
						placeholder="Название кастинга"
						className={styles.input}
					/>
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Город проведения <span className={styles.req}>*</span></label>
					<input
						value={city}
						onChange={e => setCity(e.target.value)}
						placeholder="Москва, Санкт-Петербург..."
						className={styles.input}
					/>
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Категория кастинга <span className={styles.req}>*</span></label>
					<div className={styles.chipRow}>
						{CATEGORIES.map(cat => (
							<button
								key={cat}
								type="button"
								className={`${styles.chip} ${category === cat ? styles.chipActive : ''}`}
								onClick={() => setCategory(category === cat ? '' : cat)}
							>{cat}</button>
						))}
					</div>
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Тип роли <span className={styles.req}>*</span></label>
					<div className={styles.checkRow}>
						{ROLE_TYPES.map(role => (
							<label key={role} className={styles.checkLabel}>
								<input
									type="checkbox"
									checked={roleTypes.includes(role)}
									onChange={() => setRoleTypes(prev =>
										prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
									)}
								/>
								{role}
							</label>
						))}
					</div>
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Пол <span className={styles.req}>*</span></label>
					<div className={styles.chipRow}>
						{GENDERS.map(g => (
							<button
								key={g}
								type="button"
								className={`${styles.chip} ${gender === g ? styles.chipActive : ''}`}
								onClick={() => { setGender(gender === g ? '' : g); setGenderCustom('') }}
							>{g}</button>
						))}
						<button
							type="button"
							className={`${styles.chip} ${gender === 'custom' ? styles.chipActive : ''}`}
							onClick={() => setGender(gender === 'custom' ? '' : 'custom')}
						>Свой вариант</button>
					</div>
					{gender === 'custom' && (
						<input
							value={genderCustom}
							onChange={e => setGenderCustom(e.target.value)}
							placeholder="Укажите (напр. животное, реквизит, авто...)"
							className={styles.input}
							style={{ marginTop: 8 }}
						/>
					)}
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Требуемый возраст <span className={styles.req}>*</span></label>
					<div className={styles.row}>
						<input
							type="number"
							min={0}
							max={120}
							value={ageFrom}
							onChange={e => setAgeFrom(e.target.value)}
							placeholder="От"
							className={styles.input}
						/>
						<span className={styles.dash}>—</span>
						<input
							type="number"
							min={0}
							max={120}
							value={ageTo}
							onChange={e => setAgeTo(e.target.value)}
							placeholder="До"
							className={styles.input}
						/>
					</div>
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Финансовые условия <span className={styles.req}>*</span></label>
					<label className={styles.checkLabel} style={{ marginBottom: 8 }}>
						<input
							type="checkbox"
							checked={financeNegotiable}
							onChange={() => { setFinanceNegotiable(!financeNegotiable); setFinance('') }}
						/>
						Обсуждаются индивидуально
					</label>
					{!financeNegotiable && (
						<input
							value={finance}
							onChange={e => setFinance(e.target.value)}
							placeholder="Сумма (напр. 15 000 ₽)"
							className={styles.input}
						/>
					)}
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Даты съёмки <span className={styles.req}>*</span></label>
					<div className={styles.row}>
						<div className={styles.dateField}>
							<span className={styles.dateLabel}>С</span>
							<input
								type="date"
								value={shootDateFrom}
								onChange={e => {
									const v = e.target.value
									setShootDateFrom(v)
									if (shootDateTo && v && shootDateTo < v) setShootDateTo(v)
								}}
								className={styles.input}
							/>
						</div>
						<div className={styles.dateField}>
							<span className={styles.dateLabel}>По</span>
							<input
								type="date"
								value={shootDateTo}
								min={shootDateFrom || undefined}
								onChange={e => setShootDateTo(e.target.value)}
								className={styles.input}
							/>
						</div>
					</div>
				</section>

				<section className={styles.section}>
					<label className={styles.label}>Описание <span className={styles.req}>*</span></label>
					<textarea
						value={description}
						onChange={e => setDescription(e.target.value)}
						placeholder="Подробное описание кастинга, требования к актёрам..."
						className={styles.textarea}
						rows={5}
					/>
				</section>

				<div className={styles.submitRow}>
					<button
						className={styles.draftBtn}
						disabled={savingDraft || creating || !title.trim()}
						onClick={() => createCasting(true)}
					>
						{savingDraft ? <IconLoader size={14} /> : null}
						{savingDraft ? 'Сохраняем…' : 'В черновик'}
					</button>
					<button
						className={styles.submitBtn}
						disabled={creating || savingDraft || !isValid}
						onClick={() => createCasting(false)}
					>
						{creating ? <IconLoader size={14} /> : <IconPlus size={14} />}
						{creating ? 'Создаём…' : 'Опубликовать'}
					</button>
				</div>
			</div>
		</div>
	)
}
