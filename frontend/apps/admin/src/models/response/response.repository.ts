import { AxiosInstance } from 'axios'

import { http, withPrefix } from '~packages/lib'

import {
	actorConfig,
	castingConfig,
	IResponseActor,
	IResponseCasting,
	UseResponsesActors,
	UseResponsesCastings,
} from '@prostoprobuy/models'
import { BaseRepository, prepareRequestParams } from '@prostoprobuy/toolkit'
import { ListResponse, RequestResponse } from '@prostoprobuy/types'

export class BuildResponseActorRepository extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async all(
		actor: number,
		params?: Partial<UseResponsesActors>,
	): RequestResponse<ListResponse<IResponseActor>> {
		return await this.instance.get(
			withPrefix(`${actorConfig.actors}/responses/${actor}/`),
			{
				params: prepareRequestParams(params),
			},
		)
	}
}

export const ResponseActorRepository = new BuildResponseActorRepository(
	http,
	actorConfig.actors,
)

export class BuildResponseCastingRepository extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async all(
		casting: number,
		params?: Partial<UseResponsesCastings>,
	): RequestResponse<ListResponse<IResponseCasting>> {
		return await this.instance.get(
			withPrefix(`${castingConfig.castings}/responses/${casting}/`),
			{
				params: prepareRequestParams(params),
			},
		)
	}
}

export const ResponseCastingRepository = new BuildResponseCastingRepository(
	http,
	castingConfig.castings,
)
