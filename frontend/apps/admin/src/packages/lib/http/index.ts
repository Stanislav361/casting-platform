import axios, { AxiosError } from 'axios'

import { withPrefix } from '~packages/lib'
import { API_URL } from '~packages/system'

import { $session, authConfig, login, logout } from '@prostoprobuy/models'

export const http = axios.create({
	baseURL: `${API_URL}/`,
	withCredentials: false,
	xsrfCookieName: 'csrftoken',
	xsrfHeaderName: 'X-CSRFToken',
	timeoutErrorMessage: 'Превышено время ожидания ответа от сервера',
	headers: {
		'Content-Type': 'application/json',
		'X-Requested-With': 'XMLHttpRequest',
		Accept: 'application/json',
	},
})

http.interceptors.request.use(
	async config => {
		const access_token = $session.getState().access_token
		if (access_token) {
			config.headers.Authorization = `Bearer ${access_token}`
		}
		return config
	},
	(error: AxiosError) => Promise.reject(error),
)

http.interceptors.response.use(
	response => response,
	async error => {
		const originalRequest = error.config

		if (!error.response) {
			return Promise.reject(error)
		}

		if (error.response.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true

			try {
				const response = await http.get(
					`${withPrefix(authConfig.auth)}`,
				)

				const newAccessToken = response.data

				login({
					access_token: newAccessToken,
				})

				originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

				return http(originalRequest)
			} catch (refreshError) {
				logout()
				window.location.replace('/')
				return Promise.reject(refreshError)
			}
		}
		return Promise.reject(error)
	},
)
