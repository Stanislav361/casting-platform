import { UseActors } from '../actor'
import { UseCastings } from '../casting'
import { z } from 'zod'

import { Branded, InjectProps } from '@prostoprobuy/types'

import {
	ReadonlyResponseActorSchema,
	ReadonlyResponseCastingSchema,
} from './response.schema'

export type ResponseActorID = Branded<number, 'ResponseActorID'>

export type IResponseActor = z.infer<typeof ReadonlyResponseCastingSchema>

export type WithResponseActor = InjectProps<'response', IResponseActor>

export type WithResponseActorID = InjectProps<'response', ResponseActorID>

export type UseResponsesActors = UseCastings & {
	actor_id: number
}

export type ResponseCastingID = Branded<number, 'ResponseCastingID'>

export type IResponseCasting = z.infer<typeof ReadonlyResponseActorSchema>

export type WithResponseCasting = InjectProps<'response', IResponseCasting>

export type WithResponseCastingID = InjectProps<'response', ResponseCastingID>

export type UseResponsesCastings = UseActors & {
	casting_id: number
}
