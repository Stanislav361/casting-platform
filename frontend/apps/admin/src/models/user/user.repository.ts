import { AxiosInstance } from 'axios'

import { http, withPrefix } from '~packages/lib'

import {
	ICreateUser,
	IUpdateUser,
	IUser,
	Roles,
	userConfig,
	UseUsers,
} from '@prostoprobuy/models'
import { CrudRepository } from '@prostoprobuy/toolkit'
import { ListResponse, RequestResponse } from '@prostoprobuy/types'

export class BuildUserRepository extends CrudRepository<
	ListResponse<IUser>,
	IUser,
	ICreateUser,
	IUpdateUser,
	UseUsers
> {
	constructor(
		readonly http: AxiosInstance,
		readonly URL: string,
	) {
		super(http, URL)
	}

	async current(): RequestResponse<IUser> {
		return await this.http.get(`${this.URL}/current/`)
	}

	async roles(id: number, data: Roles) {
		return await this.http.patch(
			`${this.URL}/${id}/roles/?role=${data}`,
			data,
		)
	}
}

export const UserRepository = new BuildUserRepository(
	http,
	withPrefix(userConfig.users),
)
