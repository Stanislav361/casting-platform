import { AxiosInstance } from 'axios'

import { http, withPrefix, withProducerPrefix } from '~packages/lib'

import {
	ActorID,
	ICreateReport,
	IFullReport,
	IProducerReportFavorite,
	IReport,
	IReportActor,
	IUpdateReport,
	IWriteableReportActor,
	ProducerReportActorResponse,
	reportConfig,
	ReportPublicID,
	UseProducerReportActors,
	UseReportActors,
	UseReports,
} from '@prostoprobuy/models'
import { BaseRepository, prepareRequestParams } from '@prostoprobuy/toolkit'
import { ListResponse, RequestResponse } from '@prostoprobuy/types'

export class BuildReportRepository extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async all(
		params?: Partial<UseReports>,
	): RequestResponse<ListResponse<IReport>> {
		return await this.http.get(`${this.URL}/`, {
			params: prepareRequestParams(params),
		})
	}

	async getById(
		id,
		params?: Partial<UseReportActors>,
	): RequestResponse<IReport> {
		return await this.http.get(`${this.URL}/${id}/widget`, {
			params: prepareRequestParams(params),
		})
	}

	async getFullById(
		id,
		params?: Partial<UseReportActors>,
	): RequestResponse<IFullReport> {
		return await this.http.get(`${this.URL}/${id}/`, {
			params: prepareRequestParams(params),
		})
	}

	async create(data: ICreateReport): RequestResponse<IReport> {
		return await this.http.post(`${this.URL}/create/`, data)
	}

	async update(id: number, data: IUpdateReport): RequestResponse<IReport> {
		return await this.http.patch(`${this.URL}/${id}/edit/`, data)
	}

	async delete(id: number): RequestResponse<any> {
		return await this.http.delete(`${this.URL}/${id}/delete/`)
	}

	async generate(id: number): RequestResponse<string> {
		return await this.http.post(`${this.URL}/${id}/generate/`)
	}

	async getActorsIds(
		id: number,
		params?: Partial<UseReportActors>,
	): RequestResponse<{
		response: ActorID[]
	}> {
		return await this.http.get(`${this.URL}/${id}/id`, {
			params: prepareRequestParams(params),
		})
	}

	async getActors(
		id: number,
		params?: Partial<UseReportActors>,
	): RequestResponse<ListResponse<IReportActor>> {
		return await this.http.get(`${this.URL}/actors/${id}/`, {
			params: prepareRequestParams(params),
		})
	}

	async editActors(
		id: number,
		data: IWriteableReportActor,
	): RequestResponse<number> {
		return await this.http.post(`${this.URL}/actors/${id}/create/`, data)
	}

	async deleteActors(
		id: number,
		data: IWriteableReportActor,
	): RequestResponse<number> {
		return await this.http.post(`${this.URL}/actors/${id}/delete/`, data)
	}

	async deleteFullActors(id: number): RequestResponse<number> {
		return await this.http.post(`${this.URL}/actors/${id}/full-delete/`)
	}
}

export const ReportRepository = new BuildReportRepository(
	http,
	withPrefix(reportConfig.reports),
)

export class BuildProducerReportRepository extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async getActors(
		public_id: ReportPublicID,
		params?: Partial<UseProducerReportActors>,
	): RequestResponse<ProducerReportActorResponse> {
		return await this.http.get(`${this.URL}/${public_id}/`, {
			params: prepareRequestParams(params),
		})
	}

	async getActor(
		actorId: ActorID,
	): RequestResponse<ProducerReportActorResponse> {
		return await this.http.get(`${reportConfig.producerActors}/${actorId}/`)
	}

	async createFavorite(
		public_id: ReportPublicID,
		data: IProducerReportFavorite,
	): RequestResponse<number> {
		return await this.http.post(
			`${this.URL}/favorite/${public_id}/create/?actor_id=${data.actor_id}`,
		)
	}

	async deleteFavorite(
		public_id: ReportPublicID,
		data: IProducerReportFavorite,
	): RequestResponse<number> {
		return await this.http.post(
			`${this.URL}/favorite/${public_id}/delete/?actor_id=${data.actor_id}`,
		)
	}

	async clearFavorites(public_id: ReportPublicID): RequestResponse<number> {
		return await this.http.post(
			`${this.URL}/favorite/${public_id}/full-delete/`,
		)
	}
}

export const ProducerReportRepository = new BuildProducerReportRepository(
	http,
	withProducerPrefix(reportConfig.reports),
)
