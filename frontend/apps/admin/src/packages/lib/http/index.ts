import axios, { AxiosError } from 'axios'

import { API_URL } from '~packages/system'

import { $session, login, logout } from '@prostoprobuy/models'

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
		const originalRequest = error.config as any

		if (!error.response || !originalRequest) {
			return Promise.reject(error)
		}

		if (String(originalRequest.url || '').includes('auth/v2/refresh/')) {
			logout()
			window.location.replace('/')
			return Promise.reject(error)
		}

		if (error.response.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true

			try {
				const response = await http.post('auth/v2/refresh/')
				const newAccessToken = response.data?.access_token

				if (!newAccessToken) {
					throw new Error('No access token returned from refresh endpoint')
				}
				login({
					access_token: newAccessToken,
				})

				originalRequest.headers = originalRequest.headers || {}
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
