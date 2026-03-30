export interface IMediaAsset {
	id: number
	file_type: 'photo' | 'video'
	photo_category: 'portrait' | 'profile' | 'full_height' | 'additional' | null
	original_url: string
	processed_url: string | null
	thumbnail_url: string | null
	mime_type: string | null
	file_size: number | null
	width: number | null
	height_px: number | null
	duration_sec: number | null
	sort_order: number
	is_primary: boolean
}

export interface IActorProfile {
	id: number
	user_id: number
	display_name: string | null
	first_name: string | null
	last_name: string | null
	gender: string | null
	date_of_birth: string | null
	phone_number: string | null
	email: string | null
	city: string | null
	qualification: string | null
	experience: number | null
	about_me: string | null
	look_type: string | null
	hair_color: string | null
	hair_length: string | null
	height: number | null
	clothing_size: string | null
	shoe_size: string | null
	bust_volume: number | null
	waist_volume: number | null
	hip_volume: number | null
	video_intro: string | null
	extra_portfolio_url: string | null
	trust_score: number
	is_active: boolean
	media_assets: IMediaAsset[]
	created_at: string | null
	updated_at: string | null
}

export interface IActorProfileListItem {
	id: number
	display_name: string | null
	first_name: string | null
	last_name: string | null
	gender: string | null
	city: string | null
	qualification: string | null
	is_active: boolean
	primary_photo: string | null
}

export interface IActorProfileSwitchList {
	profiles: IActorProfileListItem[]
	current_profile_id: number | null
}

export interface IActorProfileCreate {
	display_name?: string
	first_name?: string
	last_name?: string
	gender?: string
	date_of_birth?: string
	phone_number?: string
	email?: string
	city?: string
	qualification?: string
	experience?: number
	about_me?: string
	look_type?: string
	hair_color?: string
	hair_length?: string
	height?: number
	clothing_size?: string
	shoe_size?: string
	bust_volume?: number
	waist_volume?: number
	hip_volume?: number
	video_intro?: string
	extra_portfolio_url?: string
}

export type IActorProfileUpdate = Partial<IActorProfileCreate>

// Auth V2 types
export interface IEmailPasswordLogin {
	email: string
	password: string
}

export interface IEmailPasswordRegister {
	email: string
	password: string
	first_name?: string
	last_name?: string
}

export interface IOTPSend {
	destination: string
	destination_type: 'email' | 'sms'
}

export interface IOTPVerify {
	destination: string
	code: string
}

export interface IAuthTokenResponse {
	access_token: string
	token_type: string
}

export interface IOTPSendResponse {
	message: string
	destination: string
	code?: string // only in dev mode
}


