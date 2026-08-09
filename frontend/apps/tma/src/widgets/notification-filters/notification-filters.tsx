'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiCall } from '~/shared/api-client'
import { useRussianCities } from '~/shared/use-russian-cities'
import { PROJECT_CATEGORIES, ROLE_TYPES } from '~/shared/casting-dictionaries'
import {
	IconBell,
	IconCheck,
	IconLoader,
	IconX,
	IconPlus,
	IconChevronDown,
} from '~packages/ui/icons'
import styles from './notification-filters.module.scss'

interface Prefs {
	casting_filters_enabled: boolean
	cities: string[]
	genders: string[]
	age_from: number | null
	age_to: number | null
	min_fee: number | null
	project_categories: string[]
	role_types: string[]
	date_from: string | null
	date_to: string | null
}

const GENDER_OPTIONS: { value: string; label: string }[] = [
	{ value: 'male', label: 'Мужской' },
	{ value: 'female', label: 'Женский' },
]

const toNum = (v: string): number | null => {
	const t = v.trim()
	if (!t) return null
	const n = parseInt(t, 10)
	return Number.isFinite(n) && n >= 0 ? n : null
}

export default function NotificationFilters() {
	const allCities = useRussianCities()

	const [loading, setLoading] = useState(true)
	const [expanded, setExpanded] = useState(false)
	const [saving, setSaving] = useState(false)
	const [savedMsg, setSavedMsg] = useState<string | null>(null)

	const [enabled, setEnabled] = useState(false)
	const [cities, setCities] = useState<string[]>([])
	const [cityQuery, setCityQuery] = useState('')
	const [genders, setGenders] = useState<string[]>([])
	const [ageFrom, setAgeFrom] = useState('')
	const [ageTo, setAgeTo] = useState('')
	const [minFee, setMinFee] = useState('')
	const [categories, setCategories] = useState<string[]>([])
	const [roleTypes, setRoleTypes] = useState<string[]>([])
	const [dateFrom, setDateFrom] = useState('')
	const [dateTo, setDateTo] = useState('')

	const applyPrefs = useCallback((data: Prefs) => {
		setEnabled(!!data.casting_filters_enabled)
		setCities(Array.isArray(data.cities) ? data.cities : [])
		setGenders(Array.isArray(data.genders) ? data.genders : [])
		setAgeFrom(data.age_from != null ? String(data.age_from) : '')
		setAgeTo(data.age_to != null ? String(data.age_to) : '')
		setMinFee(data.min_fee != null ? String(data.min_fee) : '')
		setCategories(Array.isArray(data.project_categories) ? data.project_categories : [])
		setRoleTypes(Array.isArray(data.role_types) ? data.role_types : [])
		setDateFrom(data.date_from || '')
		setDateTo(data.date_to || '')
	}, [])

	useEffect(() => {
		let cancelled = false
		;(async () => {
			const data = await apiCall('GET', 'notifications/preferences/')
			if (!cancelled && data && !data.detail) applyPrefs(data as Prefs)
			if (!cancelled) setLoading(false)
		})()
		return () => { cancelled = true }
	}, [applyPrefs])

	const toggleIn = (list: string[], setList: (v: string[]) => void, value: string) => {
		setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
	}

	const addCity = (raw: string) => {
		const value = raw.trim()
		if (!value) return
		if (!cities.some(c => c.toLowerCase() === value.toLowerCase())) {
			setCities([...cities, value])
		}
		setCityQuery('')
	}

	const removeCity = (value: string) => setCities(cities.filter(c => c !== value))

	const save = async () => {
		setSaving(true)
		setSavedMsg(null)
		const payload = {
			casting_filters_enabled: enabled,
			cities,
			genders,
			age_from: toNum(ageFrom),
			age_to: toNum(ageTo),
			min_fee: toNum(minFee),
			project_categories: categories,
			role_types: roleTypes,
			date_from: dateFrom || null,
			date_to: dateTo || null,
		}
		const result = await apiCall('PATCH', 'notifications/preferences/', payload)
		setSaving(false)
		if (result && !result.detail) {
			applyPrefs(result as Prefs)
			setSavedMsg('Фильтры сохранены')
			setTimeout(() => setSavedMsg(null), 3000)
		} else {
			setSavedMsg('Не удалось сохранить. Попробуйте ещё раз.')
		}
	}

	return (
		<section className={styles.section}>
			<button
				type="button"
				className={styles.accHeader}
				onClick={() => setExpanded(v => !v)}
				aria-expanded={expanded}
			>
				<span className={styles.accTitle}>
					<IconBell size={16} />
					<span>Фильтры уведомлений о кастингах</span>
				</span>
				<IconChevronDown
					size={18}
					className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
				/>
			</button>

			{expanded && (
				<div className={styles.body}>
					{loading ? (
						<div className={styles.loading}><IconLoader size={16} /> Загрузка…</div>
					) : (
						<>
							<p className={styles.hint}>
								Получайте оповещения только о подходящих кастингах. Выберите
								нужные параметры — пустое поле означает «без ограничения».
							</p>

							{/* Master toggle */}
							<button
								type="button"
								className={`${styles.masterToggle} ${enabled ? styles.masterOn : ''}`}
								onClick={() => setEnabled(v => !v)}
							>
								<span className={styles.switch}>
									<span className={styles.switchKnob} />
								</span>
								<span className={styles.masterLabel}>
									{enabled
										? 'Фильтры включены — приходят только подходящие кастинги'
										: 'Фильтры выключены — приходят все кастинги по вашей анкете'}
								</span>
							</button>

							<div className={`${styles.controls} ${enabled ? '' : styles.controlsDisabled}`}>
								{/* Cities */}
								<div className={styles.field}>
									<label className={styles.label}>Города</label>
									{cities.length > 0 && (
										<div className={styles.chips}>
											{cities.map(c => (
												<span key={c} className={styles.chipRemovable}>
													{c}
													<button type="button" onClick={() => removeCity(c)} aria-label="Удалить">
														<IconX size={12} />
													</button>
												</span>
											))}
										</div>
									)}
									<div className={styles.cityAdd}>
										<input
											className={styles.input}
											list="notif-city-list"
											value={cityQuery}
											onChange={e => setCityQuery(e.target.value)}
											onKeyDown={e => {
												if (e.key === 'Enter') { e.preventDefault(); addCity(cityQuery) }
											}}
											placeholder="Начните вводить город"
										/>
										<datalist id="notif-city-list">
											{allCities.map(c => <option key={c} value={c} />)}
										</datalist>
										<button
											type="button"
											className={styles.addBtn}
											onClick={() => addCity(cityQuery)}
											disabled={!cityQuery.trim()}
										>
											<IconPlus size={14} /> Добавить
										</button>
									</div>
								</div>

								{/* Gender */}
								<div className={styles.field}>
									<label className={styles.label}>Пол</label>
									<div className={styles.chips}>
										{GENDER_OPTIONS.map(g => (
											<button
												key={g.value}
												type="button"
												className={`${styles.chip} ${genders.includes(g.value) ? styles.chipActive : ''}`}
												onClick={() => toggleIn(genders, setGenders, g.value)}
											>
												{g.label}
											</button>
										))}
									</div>
								</div>

								{/* Age */}
								<div className={styles.field}>
									<label className={styles.label}>Возраст</label>
									<div className={styles.rangeRow}>
										<input
											className={styles.input}
											type="number"
											inputMode="numeric"
											min={0}
											max={120}
											value={ageFrom}
											onChange={e => setAgeFrom(e.target.value)}
											placeholder="от"
										/>
										<span className={styles.rangeDash}>—</span>
										<input
											className={styles.input}
											type="number"
											inputMode="numeric"
											min={0}
											max={120}
											value={ageTo}
											onChange={e => setAgeTo(e.target.value)}
											placeholder="до"
										/>
									</div>
								</div>

								{/* Min fee */}
								<div className={styles.field}>
									<label className={styles.label}>Гонорар от, ₽</label>
									<input
										className={styles.input}
										type="number"
										inputMode="numeric"
										min={0}
										value={minFee}
										onChange={e => setMinFee(e.target.value)}
										placeholder="например, 5000"
									/>
								</div>

								{/* Categories */}
								<div className={styles.field}>
									<label className={styles.label}>Категория кастинга</label>
									<div className={styles.chips}>
										{PROJECT_CATEGORIES.map(c => (
											<button
												key={c}
												type="button"
												className={`${styles.chip} ${categories.includes(c) ? styles.chipActive : ''}`}
												onClick={() => toggleIn(categories, setCategories, c)}
											>
												{c}
											</button>
										))}
									</div>
								</div>

								{/* Role types */}
								<div className={styles.field}>
									<label className={styles.label}>Тип роли</label>
									<div className={styles.chips}>
										{ROLE_TYPES.map(r => (
											<button
												key={r}
												type="button"
												className={`${styles.chip} ${roleTypes.includes(r) ? styles.chipActive : ''}`}
												onClick={() => toggleIn(roleTypes, setRoleTypes, r)}
											>
												{r}
											</button>
										))}
									</div>
								</div>

								{/* Shooting dates */}
								<div className={styles.field}>
									<label className={styles.label}>Дата съёмок</label>
									<div className={styles.rangeRow}>
										<input
											className={styles.input}
											type="date"
											value={dateFrom}
											max={dateTo || undefined}
											onChange={e => setDateFrom(e.target.value)}
										/>
										<span className={styles.rangeDash}>—</span>
										<input
											className={styles.input}
											type="date"
											value={dateTo}
											min={dateFrom || undefined}
											onChange={e => setDateTo(e.target.value)}
										/>
									</div>
								</div>
							</div>

							<div className={styles.actions}>
								<button className={styles.saveBtn} onClick={save} disabled={saving}>
									{saving ? <><IconLoader size={14} /> Сохранение…</> : <><IconCheck size={14} /> Сохранить фильтры</>}
								</button>
								{savedMsg && <span className={styles.savedMsg}>{savedMsg}</span>}
							</div>
						</>
					)}
				</div>
			)}
		</section>
	)
}
