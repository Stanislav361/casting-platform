export const IS_CLIENT = typeof window !== 'undefined'

export const IS_DEV = process.env.NODE_ENV === 'development'

export const IS_PROD = process.env.NODE_ENV === 'production'

export const API_URL = `${process.env.API_URL || 'https://api.prostoprobuy-dev.ru/'}`

export const BASE_ROOT_URL = '/'

export const IMAGE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']

export const PHONE_MASK = '+7 (___) ___-__-__'

export const DATE_MASK = 'dd.mm.yyyy'

export const BASE_OPTION = [
	{
		label: 'Не выбрано',
		value: '',
	},
]

export const BASE_SORT_BY_OPTIONS = [
	{
		label: 'По убыванию',
		value: 'desc',
	},
	{
		label: 'По возрастанию',
		value: 'asc',
	},
]

export const DEFAULT_EXCLUDE_FIELDS = [
	'query',
	'skip',
	'limit',
	'page',
	'sort_by',
	'sort_order',
	'page_size',
	'page_number',
]
