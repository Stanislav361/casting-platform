import { AxiosInstance } from 'axios'

import {
	CastingResponse,
	ICasting,
	IListCasting,
} from '~models/casting/casting.types'

import { http, withPrefix } from '~packages/lib'

import { castingConfig } from '@prostoprobuy/models'
import { ReadonlyRepository } from '@prostoprobuy/toolkit'
import { ListResponse, RequestResponse } from '@prostoprobuy/types'

export class BuildCastingRepository extends ReadonlyRepository<
	ListResponse<IListCasting>,
	ICasting
> {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async getResponse(casting_id: number): RequestResponse<CastingResponse> {
		return this.http.get(`${this.URL}/responses/${casting_id}/`)
	}
}

export const CastingRepository = new BuildCastingRepository<
	ListResponse<IListCasting>,
	ICasting
>(http, withPrefix(castingConfig.castings))
