import { calcPercent } from '../fn'
import { AxiosInstance } from 'axios'

import { Dictionary, Nullable, OnUploadProgress } from '@prostoprobuy/types'

import { BaseRepository } from './base'

export class ImageRepository<
	ADD_IMAGE = Dictionary<Nullable<File>>,
> extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async addImageAlone(data: ADD_IMAGE, onUploadProgress?: OnUploadProgress) {
		return await this.http.post(`${this.URL}/image/create/`, data, {
			headers: {
				'Content-Type': 'multipart/form-data',
			},
			onUploadProgress: progressEvent => {
				onUploadProgress?.(
					calcPercent(progressEvent.loaded, progressEvent.total),
					progressEvent.loaded / 1024 / 1024,
					progressEvent.total / 1024 / 1024,
				)
			},
		})
	}

	async addImage(
		id: number,
		data: ADD_IMAGE,
		onUploadProgress?: OnUploadProgress,
	) {
		return await this.http.post(`${this.URL}/image/${id}/create/`, data, {
			headers: {
				'Content-Type': 'multipart/form-data',
			},
			onUploadProgress: progressEvent => {
				onUploadProgress?.(
					calcPercent(progressEvent.loaded, progressEvent.total),
					progressEvent.loaded / 1024 / 1024,
					progressEvent.total / 1024 / 1024,
				)
			},
		})
	}

	async deleteImage(id: number) {
		return await this.http.delete(`${this.URL}/image/${id}/delete/`)
	}
}
