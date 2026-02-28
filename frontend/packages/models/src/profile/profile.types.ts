import { z } from 'zod'

import { Branded, InjectProps } from '@prostoprobuy/types'

import {
	ReadonlyProfileImageSchema,
	ReadonlyProfileSchema,
	WriteableProfileImageSchema,
	WriteableProfileSchema,
} from './profile.schema'

export type ProfileID = Branded<number, 'ProfileID'>

export type IProfile = z.infer<typeof ReadonlyProfileSchema>

export type IReadonlyProfileImage = z.infer<typeof ReadonlyProfileImageSchema>

export type IProfileImage = z.infer<typeof WriteableProfileImageSchema>

export type IUpdateProfile = z.infer<typeof WriteableProfileSchema>

export type WithProfile = InjectProps<'profile', IProfile>

export type WithProfileID = InjectProps<'profile', ProfileID>
