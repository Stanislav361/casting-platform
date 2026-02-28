import { AxiosInstance } from 'axios'

import { ProfileResponse } from '~models/profile/profile.types'

import { http, withPrefix } from '~packages/lib'

import {
	IProfile,
	IProfileImage,
	IUpdateProfile,
	profileConfig,
} from '@prostoprobuy/models'
import { BaseRepository, ImageRepository } from '@prostoprobuy/toolkit'
import { RequestResponse } from '@prostoprobuy/types'

export class BuildProfileRepository extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async get(): RequestResponse<IProfile> {
		return await this.http.get(`${this.URL}/`)
	}

	async update(data: Partial<IUpdateProfile>) {
		return await this.http.patch(`${this.URL}/edit/`, data)
	}

	async createResponse(casting_id: number, data: ProfileResponse) {
		return await this.http.post(
			`${this.URL}/responses/${casting_id}/create/`,
			data,
		)
	}

	async updateResponse(casting_id: number, data: ProfileResponse) {
		return await this.http.patch(
			`${this.URL}/responses/${casting_id}/edit/`,
			data,
		)
	}
}

export const ProfileRepository = new BuildProfileRepository(
	http,
	withPrefix(profileConfig.profile),
)

export const ProfileImageRepository = new ImageRepository<IProfileImage>(
	http,
	withPrefix(profileConfig.profile),
)
