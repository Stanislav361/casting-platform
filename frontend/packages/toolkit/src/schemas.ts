import { z, ZodTypeAny } from 'zod'

import { IMAGE_FILE_TYPES } from '@prostoprobuy/system'
import { Branded } from '@prostoprobuy/types'

import { stripTags } from './fn'
import { regexPatterns } from './regex'

export const buildFileShape = (
	fileUploads: string[],
	video_upload_size_md: number = 10,
) => {
	if (typeof window === 'undefined') return z.any()

	return z
		.instanceof(File, {
			message: 'Пожалуйста, выберите файл',
		})
		.refine(file => fileUploads.includes(file.type), {
			message: `Неверный тип файла. Разрешены: ${fileUploads.join(', ')}`,
		})
		.refine(file => file.size <= video_upload_size_md * 1024 * 1024, {
			message: `Размер файла не должен превышать ${video_upload_size_md} МБ`,
		})
}

export function zBrand<T extends ZodTypeAny, B extends string>(
	schema: T,
	_brand: B,
): z.ZodEffects<T, Branded<z.infer<T>, B>> {
	return schema.transform(val => val as Branded<z.infer<T>, B>)
}

export const zSchema = {
	id: z
		.number({
			message: 'Поле не может быть пустым',
		})
		.positive()
		.min(1),
	indicator: z.string().refine(
		val => {
			const num = Number(val)
			return !isNaN(num) && num > 0
		},
		{
			message: 'Должно быть числом больше 0',
		},
	),
	isZero: z.string().refine(
		val => {
			const num = Number(val)
			return !isNaN(num) && num >= 0
		},
		{
			message: 'Должно быть числом от 0 и выше',
		},
	),
	image: buildFileShape(IMAGE_FILE_TYPES, 25),
	ids: z.number().positive().array(),
	uuid: z.string().uuid(),
	date: z
		.string({
			message: 'Поле не может быть пустым',
		})
		.date('Неверный формат даты'),
	datetime: z
		.string({
			message: 'Поле не может быть пустым',
		})
		.datetime({
			message: 'Неверный формат даты',
		}),
	url: z.string().url({
		message: 'Неверный URL',
	}),
	choice: z
		.string({
			message: 'Поле не может быть пустым',
		})
		.min(1, {
			message: 'Пожалуйста, выберите',
		}),
	order: z.number().positive().min(1),
	color: z.string().min(7).max(7).startsWith('#'),
	title: z
		.string({
			message: 'Поле не может быть пустым',
		})
		.min(3, {
			message: 'Должно быть не менее 3 символов',
		})
		.max(100, {
			message: 'Должно быть не более 100 символов',
		}),
	name: z
		.string({
			message: 'Поле не может быть пустым',
		})
		.min(3, {
			message: 'Должно быть не менее 3 символов',
		})
		.max(64, {
			message: 'Должно быть не более 64 символов',
		}),
	description: z
		.string()
		.refine(val => stripTags(val).length >= 10, {
			message: 'Должно быть не менее 10 символов',
		})
		.refine(val => stripTags(val).length <= 4000, {
			message: 'Должно быть не более 1000 символов',
		}),
	about_me: z.string().refine(val => stripTags(val).length <= 1000, {
		message: 'Должно быть не более 1000 символов',
	}),
	telegram: z.string().min(2).max(50).startsWith('@'),
	email: z.string().email({
		message: 'Неверный email',
	}),
	password: z
		.string()
		.min(8, {
			message: 'Должно быть не менее 8 символов',
		})
		.max(255, {
			message: 'Должно быть не более 255 символов',
		}),
	decimal: z
		.string()
		.regex(regexPatterns.decimal.value, regexPatterns.decimal.message),
	phone: z
		.string({
			message: 'Укажите номер телефона',
		})
		.regex(
			regexPatterns.russianPhone.value,
			regexPatterns.russianPhone.message,
		),
	telegramUrl: z
		.string()
		.regex(
			regexPatterns.telegramUrl.value,
			regexPatterns.telegramUrl.message,
		),
	telegramUsername: z
		.string()
		.regex(regexPatterns.tg.value, regexPatterns.tg.message),
	range: (
		min: number,
		max: number,
		options?: { integerOnly?: boolean; optional?: boolean },
	) =>
		z.string().refine(
			val => {
				const num = Number(val)

				if (isNaN(num)) return false

				const inRange = num >= min && num <= max
				const isIntegerOk = options?.integerOnly
					? Number.isInteger(num)
					: true

				if (options?.optional) {
					if (val.trim() === '' || val === null) {
						return true
					}
				}

				return inRange && isIntegerOk
			},
			{
				message:
					`Число должно быть от ${min} до ${max}` +
					(options?.integerOnly ? ' и целым числом' : ''),
			},
		),
	coerce: (min: number, max: number) => z.coerce.number().min(min).max(max),
	dateAtLeastAge: (minAge: number) =>
		z.preprocess(
			val => {
				if (typeof val === 'string' || val instanceof Date) {
					const date = new Date(val)
					return new Date(
						Date.UTC(
							date.getFullYear(),
							date.getMonth(),
							date.getDate(),
						),
					)
				}
				return val
			},
			z
				.date({
					message: 'Некорректная дата',
				})
				.refine(
					date => {
						const now = new Date()
						const age =
							now.getFullYear() -
							date.getFullYear() -
							(now <
							new Date(
								now.getFullYear(),
								date.getMonth(),
								date.getDate(),
							)
								? 1
								: 0)
						return age >= minAge
					},
					{
						message: `Возраст должен быть не меньше ${minAge} лет`,
					},
				),
		),
	optional: (schema: ZodTypeAny) =>
		schema.nullable().optional().or(z.literal('')).or(z.literal(null)),
}
