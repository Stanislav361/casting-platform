/**
 * Категории персональных данных для детальной формы Согласия на
 * распространение (см. /legal/distribution-consent и backend
 * legal.documents.DISTRIBUTION_CATEGORIES — списки должны совпадать).
 *
 * По инструкции нельзя заменять детальный выбор одним общим чек-боксом:
 * у каждой категории свой переключатель, по умолчанию включены все
 * («Разрешаю» в самом документе), актёр может отключить любую из них.
 */
export const DISTRIBUTION_CATEGORIES: readonly { key: string; label: string }[] = [
	{ key: 'full_name', label: 'Ф.И.О. / отображаемое имя' },
	{ key: 'gender', label: 'Пол' },
	{ key: 'birth_date', label: 'Дата рождения / возраст' },
	{ key: 'location', label: 'Город и станция метро' },
	{ key: 'professional', label: 'Профессиональная категория, опыт, навыки, портфолио' },
	{ key: 'appearance', label: 'Тип внешности и сведения «о себе»' },
	{ key: 'measurements', label: 'Рост, размеры одежды и обуви, параметры тела' },
	{ key: 'photos', label: 'Фотографии' },
	{ key: 'video', label: 'Видеовизитка / ссылка на видео' },
	{ key: 'review_status', label: 'Статус рассмотрения в Каст-листе' },
	{ key: 'contacts', label: 'Телефон, e-mail, Telegram' },
]

export const ALL_DISTRIBUTION_CATEGORY_KEYS: readonly string[] = DISTRIBUTION_CATEGORIES.map((c) => c.key)
