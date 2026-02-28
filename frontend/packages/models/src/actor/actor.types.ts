import { CityFullName } from '../city'
import { z } from 'zod'

import {
	Branded,
	Gender,
	HairColor,
	HairLength,
	InjectProps,
	LookType,
	Qualification,
	UseModelOptions,
} from '@prostoprobuy/types'

import {
	ReadonlyActorSchema,
	ReadonlyListActorSchema,
	WritableActorSchema,
} from './actor.schema'

export type ActorID = Branded<number, 'ActorID'>

export type IActor = z.infer<typeof ReadonlyActorSchema>

export type IListActor = z.infer<typeof ReadonlyListActorSchema>

export type ICreateActor = z.infer<typeof WritableActorSchema>

export type IUpdateActor = z.infer<typeof WritableActorSchema>

export type WithActor = InjectProps<'actor', IActor>

export type WithListActor = InjectProps<'actor', IListActor>

export type WithActorID = InjectProps<'actor', ActorID>

export type UseActors = UseModelOptions<
	| 'age'
	| 'experience'
	| 'height'
	| 'clothing_size'
	| 'shoe_size'
	| 'bust_volume'
	| 'waist_volume'
	| 'hip_volume'
	| 'created_at'
	| 'response_at'
> & {
	gender: Gender
	qualification: Qualification
	look_type: LookType
	hair_color: HairColor
	hair_length: HairLength
	city: CityFullName
	min_age: string
	max_age: string
	min_experience: string
	max_experience: string
	min_height: string
	max_height: string
	min_cloth: string
	max_cloth: string
	min_shoe: string
	max_shoe: string
	min_bust: string
	max_bust: string
	min_waist: string
	max_waist: string
	min_hip: string
	max_hip: string
}
