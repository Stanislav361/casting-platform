import { AxiosInstance } from 'axios'

import { ICasting, IListCasting } from '~models/casting/casting.types'

import { http, withPrefix } from '~packages/lib'

import {
	castingConfig,
	ICastingImage,
	ICreateCasting,
	IUpdateCasting,
	UseCastings,
} from '@prostoprobuy/models'
import { ViewSetRepository } from '@prostoprobuy/toolkit'
import { ListResponse } from '@prostoprobuy/types'

export class BuildCastingRepository extends ViewSetRepository<
	ListResponse<IListCasting>,
	ICasting,
	ICreateCasting,
	IUpdateCasting,
	UseCastings,
	ICastingImage
> {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async publish(id: number) {
		return await this.http.patch(`${this.URL}/${id}/publish/`)
	}

	async unpublish(id: number) {
		return await this.http.patch(`${this.URL}/${id}/unpublish/`)
	}

	async close(id: number) {
		return await this.http.patch(`${this.URL}/${id}/close/`)
	}
}

export const CastingRepository = new BuildCastingRepository(
	http,
	withPrefix(castingConfig.castings),
)
