import { ResponseActorID, ResponseCastingID } from './response.types'

export const toResponseActorID = (id: number | string): ResponseActorID =>
	Number(id) as ResponseActorID

export const toResponseCastingID = (id: number | string): ResponseCastingID =>
	Number(id) as ResponseCastingID
