import { AxiosInstance } from 'axios'

import { TelegramAuth } from '~models/auth/auth.types'

import { http, withPrefix } from '~packages/lib'

import { authConfig } from '@prostoprobuy/models'
import { BaseRepository } from '@prostoprobuy/toolkit'
import { RequestResponse } from '@prostoprobuy/types'

export class BuildAuthRepository extends BaseRepository {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async auth(data: TelegramAuth): RequestResponse<string> {
		return await this.http.post(this.URL, data)
	}

	async predicate(predicate: boolean = false) {
		return await this.http.post(
			`${this.URL}predicate/?predicate=${predicate}`,
		)
	}

	async refreshToken(): RequestResponse<string> {
		return await this.http.get(`${this.URL}refresh-token/`)
	}
}

export const AuthRepository = new BuildAuthRepository(
	http,
	withPrefix(authConfig.auth),
)
