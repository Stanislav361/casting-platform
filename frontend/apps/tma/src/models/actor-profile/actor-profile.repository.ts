import { AxiosInstance } from 'axios'

import { http, withPrefix } from '~packages/lib'

import {
	IActorProfile,
	IActorProfileCreate,
	IActorProfileUpdate,
	IActorProfileSwitchList,
	IMediaAsset,
	IEmailPasswordLogin,
	IEmailPasswordRegister,
	IOTPSend,
	IOTPVerify,
	IAuthTokenResponse,
	IOTPSendResponse,
} from './actor-profile.types'

const ACTOR_PROFILES_URL = withPrefix('actor-profiles')

// ─── Actor Profile Repository ───

export class ActorProfileRepository {
	constructor(readonly http: AxiosInstance) {}

	/** Создать новый профиль актёра */
	async create(data: IActorProfileCreate) {
		return await this.http.post<IActorProfile>(`${ACTOR_PROFILES_URL}/`, data)
	}

	/** Получить все мои профили (Switch Profile UI) */
	async getMyProfiles() {
		return await this.http.get<IActorProfileSwitchList>(
			`${ACTOR_PROFILES_URL}/my/`,
		)
	}

	/** Получить конкретный профиль */
	async getProfile(profileId: number) {
		return await this.http.get<IActorProfile>(
			`${ACTOR_PROFILES_URL}/${profileId}/`,
		)
	}

	/** Обновить профиль */
	async updateProfile(profileId: number, data: IActorProfileUpdate) {
		return await this.http.patch<IActorProfile>(
			`${ACTOR_PROFILES_URL}/${profileId}/`,
			data,
		)
	}

	/** Загрузить фото */
	async uploadPhoto(
		profileId: number,
		file: File,
		photoCategory: 'portrait' | 'profile' | 'full_height' | 'additional',
	) {
		const formData = new FormData()
		formData.append('file', file)
		formData.append('photo_category', photoCategory)
		return await this.http.post<IMediaAsset>(
			`${ACTOR_PROFILES_URL}/${profileId}/media/photo/`,
			formData,
			{
				headers: { 'Content-Type': 'multipart/form-data' },
			},
		)
	}

	/** Загрузить видео */
	async uploadVideo(profileId: number, file: File) {
		const formData = new FormData()
		formData.append('file', file)
		return await this.http.post<IMediaAsset>(
			`${ACTOR_PROFILES_URL}/${profileId}/media/video/`,
			formData,
			{
				headers: { 'Content-Type': 'multipart/form-data' },
			},
		)
	}

	/** Удалить медиа-ассет */
	async deleteMedia(profileId: number, assetId: number) {
		return await this.http.delete(
			`${ACTOR_PROFILES_URL}/${profileId}/media/${assetId}/`,
		)
	}

	/** Установить медиа как основное фото */
	async setPrimaryMedia(profileId: number, assetId: number) {
		return await this.http.patch(
			`${ACTOR_PROFILES_URL}/${profileId}/media/${assetId}/primary/`,
		)
	}
}

export const actorProfileRepository = new ActorProfileRepository(http)

// ─── Auth V2 Repository ───

export class AuthV2Repository {
	constructor(readonly http: AxiosInstance) {}

	/** Регистрация по Email/Password */
	async register(data: IEmailPasswordRegister) {
		return await this.http.post<IAuthTokenResponse>(
			'auth/v2/register/',
			data,
		)
	}

	/** Вход по Email/Password */
	async login(data: IEmailPasswordLogin) {
		return await this.http.post<IAuthTokenResponse>(
			'auth/v2/login/',
			data,
		)
	}

	/** Отправить OTP */
	async sendOTP(data: IOTPSend) {
		return await this.http.post<IOTPSendResponse>(
			'auth/v2/otp/send/',
			data,
		)
	}

	/** Верифицировать OTP */
	async verifyOTP(data: IOTPVerify) {
		return await this.http.post<IAuthTokenResponse>(
			'auth/v2/otp/verify/',
			data,
		)
	}

	/** Обновить access token */
	async refreshToken() {
		return await this.http.post<IAuthTokenResponse>('auth/v2/refresh/')
	}

	/** Переключить профиль */
	async switchProfile(profileId: number) {
		return await this.http.post<IAuthTokenResponse>(
			'auth/v2/switch-profile/',
			{ profile_id: profileId },
		)
	}
}

export const authV2Repository = new AuthV2Repository(http)


