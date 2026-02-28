import { http, withPrefix } from '~packages/lib'

import {
	actorConfig,
	IActor,
	IListActor,
	UseActors,
} from '@prostoprobuy/models'
import { ReadonlyRepository } from '@prostoprobuy/toolkit'
import { ListResponse } from '@prostoprobuy/types'

export const ActorRepository = new ReadonlyRepository<
	ListResponse<IListActor>,
	IActor,
	UseActors
>(http, withPrefix(actorConfig.actors))
