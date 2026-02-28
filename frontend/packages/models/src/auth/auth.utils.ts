import { ISession } from './auth.types'

export const SESSION_INITIAL_STATE: ISession = {
	access_token: '',
}

export const ACCESS_TOKEN_DELAY = 3600 * 1000
