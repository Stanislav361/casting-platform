'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
	const searchParams = useSearchParams()
	const editId = searchParams.get('edit')
	const isEdit = Boolean(editId)

	useEffect(() => {
		if (role && !['owner', 'administrator', 'manager', 'employer_pro', 'employer'].includes(role)) {
			router.replace('/dashboard')
		}
	}, [role, router])

	const [title, setTitle] = useState('')
	const [city, setCity] = useState('')
	const [category, setCategory] = useState('')
	const [roleTypes, setRoleTypes] = useState<string[]>([])
	const [genders, setGenders] = useState<string[]>([])
	const [genderCustomOn, setGenderCustomOn] = useState(false)
	const [genderCustom, setGenderCustom] = useState('')
	const [ageFrom, setAgeFrom] = useState('')
	const [ageTo, setAgeTo] = useState('')
	const [finance, setFinance] = useState('')
	const [financeNegotiable, setFinanceNegotiable] = useState(false)
	const [shootDateFrom, setShootDateFrom] = useState('')
	const [shootDateTo, setShootDateTo] = useState('')
	const [description, setDescription] = useState('')
	const [coverFile, setCoverFile] = useState<File | null>(null)
	const [coverPreview, setCoverPreview] = useState<string | null>(null)
	const [creating, setCreating] = useState(false)
	const [savingDraft, setSavingDraft] = useState(false)
	const [loadingEdit, setLoadingEdit] = useState(isEdit)

	useEffect(() => {
		if (!coverFile) {
			setCoverPreview(null)
			return
		}
		const url = URL.createObjectURL(coverFile)
		setCoverPreview(url)
		return () => URL.revokeObjectURL(url)
	}, [coverFile])

	// Режим редактирования: подгружаем поля кастинга и заполняем форму.
	useEffect(() => {
		if (!editId) return
		let cancelled = false
		;(async () => {
			setLoadingEdit(true)
			const data = await apiCall('GET', `employer/projects/${editId}/edit-data/`)
			if (cancelled) return
			if (!data || data.detail) {
				dialog.error({
					title: 'Не удалось открыть кастинг',
					message: typeof data?.detail === 'string' ? data.detail : 'Попробуйте ещё раз.',
				})
				setLoadingEdit(false)
				return
			}
			setTitle(data.title || '')
			setDescription((data.description && data.description !== '-') ? data.description : '')
			setCity(data.city || '')
			setCategory(data.project_category || '')
			setRoleTypes(Array.isArray(data.role_types) ? data.role_types : [])
			setAgeFrom(data.age_from != null ? String(data.age_from) : '')
			setAgeTo(data.age_to != null ? String(data.age_to) : '')

			if (data.financial_conditions === 'Обсуждаются индивидуально') {
				setFinanceNegotiable(true)
				setFinance('')
			} else {
				setFinanceNegotiable(false)
				setFinance(data.financial_conditions || '')
			}

			// gender: "Мужчина, Женщина" / свой вариант
			if (data.gender) {
				const parts = String(data.gender).split(',').map((s: string) => s.trim()).filter(Boolean)
				const known = parts.filter((p: string) => GENDERS.includes(p))
				const custom = parts.filter((p: string) => !GENDERS.includes(p))
				setGenders(known)
				if (custom.length > 0) {
					setGenderCustomOn(true)
					setGenderCustom(custom.join(', '))
				}
			}

			// shooting_dates: "дд.мм.гггг - дд.мм.гггг" -> yyyy-mm-dd
			const toInputDate = (label: string): string => {
				const [d, m, y] = label.trim().split('.')
				if (!d || !m || !y) return ''
				return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
			}
			const rawDates = String(data.shooting_dates || '').trim()
			if (rawDates.includes(' - ')) {
				const [from, to] = rawDates.split(' - ')
				setShootDateFrom(toInputDate(from))
				setShootDateTo(toInputDate(to))
			} else if (rawDates) {
				setShootDateFrom(toInputDate(rawDates.replace(/^с\s+/i, '')))
			}

			if (data.image_url) setCoverPreview(data.image_url)
			setLoadingEdit(false)
		})()
		return () => { cancelled = true }
	}, [editId])

	const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result || ''))
		reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'))
		reader.readAsDataURL(file)
	})

	const handleCoverChange = (file?: File | null) => {
		if (!file) return
		if (!file.type.startsWith('image/')) {
			dialog.warn({ title: 'Это не фото', message: 'Выберите изображение в формате JPG, PNG или WebP.' })
			return
		}
		if (file.size > 15 * 1024 * 1024) {
			dialog.warn({ title: 'Файл слишком большой', message: 'Максимальный размер обложки — 15 МБ.' })
			return
		}
		setCoverFile(file)
	}

	const buildPayload = () => {
		const genderParts = [...genders]
		if (genderCustomOn && genderCustom.trim()) genderParts.push(genderCustom.trim())
		const genderValue = genderParts.join(', ')
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
			shooting_dates: shootDateFrom
				? (shootDateTo
					? `${formatDateLabel(shootDateFrom)} - ${formatDateLabel(shootDateTo)}`
					: `с ${formatDateLabel(shootDateFrom)}`)
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
			if (!shootDateFrom) return
			if (shootDateTo && shootDateTo < shootDateFrom) {
				dialog.warn({
					title: 'Проверьте даты съёмок',
					message: 'Дата окончания не может быть раньше даты начала.',
				})
				return
			}
		}
		asDraft ? setSavingDraft(true) : setCreating(true)
		try {
			// Режим редактирования: обновляем существующий кастинг, при
			// необходимости загружаем новую обложку и публикуем.
			if (isEdit && editId) {
				const updatePayload: Record<string, any> = {
					...buildPayload(),
					status: asDraft ? 'unpublished' : undefined,
				}
				const updated = await apiCall('PATCH', `employer/projects/${editId}/full/`, updatePayload)
				if (!updated?.id) {
					const msg = typeof updated?.detail === 'string' ? updated.detail : 'Попробуйте ещё раз через минуту.'
					dialog.error({ title: 'Не удалось сохранить кастинг', message: msg })
					return
				}
				if (coverFile) {
					try {
						const image_base64 = await fileToDataUrl(coverFile)
						await apiCall('POST', `employer/projects/${editId}/upload-image-json/`, { image_base64 })
					} catch {
						dialog.warn({
							title: 'Изменения сохранены, но фото не загрузилось',
							message: 'Вы сможете добавить обложку позже.',
						})
					}
				}
				if (!asDraft) {
					const published = await apiCall('POST', `employer/projects/${editId}/publish/`)
					if (!published?.id) {
						const msg = typeof published?.detail === 'string' ? published.detail : 'Изменения сохранены, но опубликовать не удалось.'
						dialog.error({ title: 'Не удалось опубликовать', message: msg })
						return
					}
				}
				router.replace(asDraft ? '/dashboard/castings' : `/dashboard/castings/${editId}`)
				return
			}

			const projectId = await resolveDefaultProjectId()
			if (!projectId) {
				dialog.error({
					title: 'Не получилось подготовить кастинг',
					message: 'Попробуйте ещё раз через минуту.',
				})
				return
			}
			// Pass the cover inline so the backend attaches it BEFORE the casting
			// is published to the Telegram channel — otherwise the channel post is
			// created without the image (it is posted the moment the casting goes
			// "published"). The backend stores the image first, then publishes.
			const payload: Record<string, any> = {
				...buildPayload(),
				status: asDraft ? 'unpublished' : 'published',
			}
			if (coverFile) {
				try {
					payload.image_base64 = await fileToDataUrl(coverFile)
				} catch {
					// fall through — casting is still created, cover can be added later
				}
			}
			const res = await apiCall('POST', `employer/projects/${projectId}/castings/`, payload)
			if (res?.id) {
				// Fallback: if the inline image did not get attached (older backend),
				// upload it the old way so the cover is still saved.
				if (coverFile && !res.image_url) {
					try {
						const image_base64 = payload.image_base64 || (await fileToDataUrl(coverFile))
						await apiCall('POST', `employer/projects/${res.id}/upload-image-json/`, { image_base64 })
					} catch {
						dialog.warn({
							title: 'Кастинг создан, но фото не загрузилось',
							message: 'Вы сможете добавить обложку позже.',
						})
					}
				}
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
		(genders.length > 0 || (genderCustomOn && genderCustom.trim())) &&
		(ageFrom || ageTo) &&
		(financeNegotiable || finance.trim()) &&
		shootDateFrom &&
		description.trim(),
	)

	if (loadingEdit) {
		return (
			<div className={styles.root}>
				<header className={styles.header}>
					<button className={styles.backBtn} onClick={goBack}>
						<IconArrowLeft size={16} />
						<span>Назад</span>
					</button>
					<h1 className={styles.title}>Редактирование кастинга</h1>
					<div style={{ width: 80 }} />
				</header>
				<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '64px 0' }}>
					<IconLoader size={24} /> Загрузка...
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>{isEdit ? 'Редактирование кастинга' : 'Новый кастинг'}</h1>
				<div style={{ width: 80 }} />
			</header>

			<div className={styles.content}>
				<section className={styles.section}>
					<label className={styles.label}>Обложка кастинга</label>
					<label className={`${styles.coverPicker} ${coverPreview ? styles.coverPickerHasImage : ''}`}>
						{coverPreview ? (
							<img src={coverPreview} alt="" />
						) : (
							<span>
								<b>Загрузить своё фото</b>
								<small>Если не загрузить, поставим одну из наших обложек автоматически</small>
							</span>
						)}
						<input
							type="file"
							accept="image/*"
							onChange={e => {
								handleCoverChange(e.target.files?.[0] || null)
								e.target.value = ''
							}}
						/>
					</label>
					{coverPreview && (
						<button type="button" className={styles.removeCoverBtn} onClick={() => setCoverFile(null)}>
							Убрать фото и использовать нашу обложку
						</button>
					)}
				</section>

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
								className={`${styles.chip} ${genders.includes(g) ? styles.chipActive : ''}`}
								onClick={() => setGenders(prev =>
									prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g],
								)}
							>{g}</button>
						))}
						<button
							type="button"
							className={`${styles.chip} ${genderCustomOn ? styles.chipActive : ''}`}
							onClick={() => setGenderCustomOn(prev => !prev)}
						>Свой вариант</button>
					</div>
					{genderCustomOn && (
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
							<span className={styles.dateLabel}>По (необязательно)</span>
							<input
								type="date"
								value={shootDateTo}
								min={shootDateFrom || undefined}
								onChange={e => setShootDateTo(e.target.value)}
								className={styles.input}
							/>
						</div>
					</div>
					<p className={styles.hint}>Можно указать только дату начала — поле «По» заполнять необязательно.</p>
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
						{savingDraft ? 'Сохраняем…' : (isEdit ? 'Сохранить черновик' : 'В черновик')}
					</button>
					<button
						className={styles.submitBtn}
						disabled={creating || savingDraft || !isValid}
						onClick={() => createCasting(false)}
					>
						{creating ? <IconLoader size={14} /> : <IconPlus size={14} />}
						{creating ? (isEdit ? 'Публикуем…' : 'Создаём…') : 'Опубликовать'}
					</button>
				</div>
			</div>
		</div>
	)
}
