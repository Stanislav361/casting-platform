import { AxiosInstance } from 'axios'

import { OnUploadProgress } from '@prostoprobuy/types'

import { BaseRepository } from './base'
import { CrudRepository } from './crud'
import { ImageRepository } from './image'

export class ViewSetRepository<
	LIST_GET,
	GET,
	CREATE,
	UPDATE,
	OPTIONS,
	ADD_IMAGE,
> extends BaseRepository {
	private crudRepository: CrudRepository<
		LIST_GET,
		GET,
		CREATE,
		UPDATE,
		OPTIONS
	>
	private imageRepository: ImageRepository<ADD_IMAGE>

	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
		this.crudRepository = new CrudRepository(http, URL)
		this.imageRepository = new ImageRepository(http, URL)
	}

	async all(params?: Partial<OPTIONS>) {
		return this.crudRepository.all(params)
	}

	async getById(id: number) {
		return this.crudRepository.getById(id)
	}

	async create(data: CREATE) {
		return this.crudRepository.create(data)
	}

	async update(id: number, data: Partial<UPDATE>) {
		return this.crudRepository.update(id, data)
	}

	async delete(id: number) {
		return this.crudRepository.delete(id)
	}

	async addImage(
		id: number,
		data: ADD_IMAGE,
		onUploadProgress?: OnUploadProgress,
	) {
		return this.imageRepository.addImage(id, data, onUploadProgress)
	}

	async deleteImage(id: number) {
		return this.imageRepository.deleteImage(id)
	}
}
