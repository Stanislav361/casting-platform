import { prepareRequestParams } from '../fn'
import { AxiosInstance } from 'axios'

import { Dictionary, RequestResponse } from '@prostoprobuy/types'

import { BaseRepository } from './base'

export class ReadonlyRepository<
	LIST_GET,
	GET,
	OPTIONS = Dictionary<any>,
> extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async search(params?: Partial<OPTIONS>): RequestResponse<LIST_GET> {
		return await this.http.get<LIST_GET>(`${this.URL}/search/`, {
			params: prepareRequestParams(params),
		})
	}

	async all(params?: Partial<OPTIONS>): RequestResponse<LIST_GET> {
		return await this.http.get<LIST_GET>(`${this.URL}/`, {
			params: prepareRequestParams(params),
		})
	}

	async getById(id: number): RequestResponse<GET> {
		return await this.http.get<GET>(`${this.URL}/${id}/`)
	}
}
