import { IResponseCasting } from '../response'

import { placeholder } from '@prostoprobuy/toolkit'
import { ImageType } from '@prostoprobuy/types'

import { ActorID, IActor } from './actor.types'

export const toActorID = (id: number | string): ActorID => Number(id) as ActorID

export const actorFullName = (actor: IActor | IResponseCasting) => {
	const name = `${actor.first_name || ''} ${actor.last_name || ''}`

	return placeholder(name, 'Нет данных', false)
}

export const actorProfileImage = (actor: IActor) => {
	return actor.images.find(i => i.image_type === ImageType.portrait)
		?.photo_url
}

export const ACTOR_SORT_BY_OPTIONS = [
	{
		label: 'По возрасту',
		value: 'age',
	},
	{
		label: 'По опыту',
		value: 'experience',
	},
	{
		label: 'По росту',
		value: 'height',
	},
	{
		label: 'По размеру одежды',
		value: 'clothing_size',
	},
	{
		label: 'По размеру обуви',
		value: 'shoe_size',
	},
	{
		label: 'По обхвату груди',
		value: 'bust_volume',
	},
	{
		label: 'По обхвату талии',
		value: 'waist_volume',
	},
	{
		label: 'По обхвату бедер',
		value: 'hip_volume',
	},
	{
		label: 'По дате регистрации',
		value: 'created_at',
	},
	{
		label: 'По дате отклика',
		value: 'response_at',
	},
]
