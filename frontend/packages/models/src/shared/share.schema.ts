import { z } from 'zod'

import { toUndefined, zBrand, zSchema } from '@prostoprobuy/toolkit'
import {
	Gender,
	HairColor,
	HairLength,
	ImageType,
	LookType,
	Qualification,
} from '@prostoprobuy/types'

import { PhysicalParameters } from './share.utils'

export const zImageId = zBrand(zSchema.id, 'ImageID')

export const CoordinateSchema = z.object({
	x1: z.number(),
	y1: z.number(),
	x2: z.number(),
	y2: z.number(),
})

export const CoordinatePositionSchema = z.object({
	top_left: z.object({
		x: z.number(),
		y: z.number(),
	}),
	bottom_right: z.object({
		x: z.number(),
		y: z.number(),
	}),
})

export const ImageSchema = z.object({
	id: zImageId,
	image_type: z.nativeEnum(ImageType),
	photo_url: zSchema.url,
})

export const PhysicalParameterSchema = z.object({
	[PhysicalParameters.height]: zSchema.range(1, 300),
	[PhysicalParameters.clothing_size]: zSchema.range(1, 100),
	[PhysicalParameters.shoe_size]: zSchema.range(1, 100),
	[PhysicalParameters.bust_volume]: z.preprocess(
		toUndefined,
		zSchema.optional(
			zSchema.range(1, 200, {
				optional: true,
			}),
		),
	),
	[PhysicalParameters.waist_volume]: z.preprocess(
		toUndefined,
		zSchema.optional(
			zSchema.range(1, 200, {
				optional: true,
			}),
		),
	),
	[PhysicalParameters.hip_volume]: z.preprocess(
		toUndefined,
		zSchema.optional(
			zSchema.range(1, 200, {
				optional: true,
			}),
		),
	),
	[PhysicalParameters.look_type]: z.nativeEnum(LookType, {
		message: 'Тип внешности обязателен',
		required_error: 'Тип внешности обязателен',
		invalid_type_error: 'Выберите корректный тип внешности',
	}),
	[PhysicalParameters.hair_color]: z.nativeEnum(HairColor, {
		message: 'Цвет волос обязателен',
		required_error: 'Цвет волос обязателен',
		invalid_type_error: 'Выберите корректный цвет волос',
	}),
	[PhysicalParameters.hair_length]: z.nativeEnum(HairLength, {
		message: 'Длина волос обязательна',
		required_error: 'Длина волос обязательна',
		invalid_type_error: 'Выберите корректную длину волос',
	}),
	[PhysicalParameters.experience]: zSchema.optional(
		zSchema.range(1, 99, {
			integerOnly: true,
			optional: true,
		}),
	),
	[PhysicalParameters.qualification]: z.nativeEnum(Qualification, {
		message: 'Квалификация обязательна',
		required_error: 'Квалификация обязательна',
		invalid_type_error: 'Выберите корректную квалификацию',
	}),
	[PhysicalParameters.gender]: z.nativeEnum(Gender, {
		message: 'Пол обязателен',
		required_error: 'Пол обязателен',
		invalid_type_error: 'Выберите корректный пол',
	}),
})
