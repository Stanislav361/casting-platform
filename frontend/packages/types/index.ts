import { type AxiosResponse } from 'axios'
import React from 'react'

export type Branded<T, B extends string> = T & { __brand: B }

export type Dictionary<T = unknown> = Record<string, T>

export type Nullable<T> = T | null

export type EnumType<T> = T[keyof T]

export type EmptyObject = Record<string, never>

export type Timeout = ReturnType<typeof setTimeout>

export type RequestResponse<T = unknown> = Promise<AxiosResponse<T>>

export type InjectProps<
	Key extends string,
	Value,
	Extras extends Record<string, any> = {},
> = {
	[K in Key]: Value
} & Extras

export type SelectOption = {
	label: string
	value?: string
	disabled?: boolean
	selected?: boolean
	hr?: boolean
}

export type ResourceType = 'actors' | 'castings'

export interface ListResponse<T> {
	meta: {
		current_page: number
		total_rows: number
		total_pages: number
	}
	response: T[]
}

export interface ValidationErrorResponse<
	T extends Record<string, any> = Record<string, any>,
> {
	detail:
		| Array<{
				type: string
				loc: keyof T[] | string[]
				msg: string
				input: string
				ctx: Record<string, string | number>
		  }>
		| {
				message: string
		  }
		| string
}

export interface PagesListResponse<T> {
	pages: ListResponse<T>[]
	pageParams: number[]
}

export type OnUploadProgress = (
	progress: number,
	uploaded: number,
	total: number,
) => void

export type ModalProps<P = unknown> = P & {
	open: boolean
	onClose: () => void
	minimal?: boolean
}

export type DetailedDivProps = React.DetailedHTMLProps<
	React.ButtonHTMLAttributes<HTMLDivElement>,
	HTMLDivElement
>

export type DetailedButtonProps = React.DetailedHTMLProps<
	React.ButtonHTMLAttributes<HTMLButtonElement>,
	HTMLButtonElement
>

export type DetailedInputProps = React.InputHTMLAttributes<HTMLInputElement>

export type DetailedSelectProps = React.DetailedHTMLProps<
	React.SelectHTMLAttributes<HTMLSelectElement>,
	HTMLSelectElement
>

export type DetailedLabelProps = React.DetailedHTMLProps<
	React.LabelHTMLAttributes<HTMLLabelElement>,
	HTMLLabelElement
>

export type DetailedTextareaProps = React.DetailedHTMLProps<
	React.TextareaHTMLAttributes<HTMLTextAreaElement>,
	HTMLTextAreaElement
>

export interface PaginationPageSize {
	page_size: number
	page_number: number
}

export type ModelListField<T, U extends Dictionary<any>> = {
	count: number
	loading: boolean
	error: boolean
	fetching?: boolean
	list: T[]
	filter: U
	checked?: number[]
	actions?: number[]
}

export type ModelListState<T, U extends Dictionary<any>> = {
	setCount: (count: number) => void
	setError: (error: boolean) => void
	setLoading: (loading: boolean) => void
	setFetching: (fetching: boolean) => void
	setChecked: (checked: number[]) => void
	setActions: (actions: number[]) => void
	setList: (list: T[]) => void
	setFilter: (filter: U) => void
	reset: () => void
} & ModelListField<T, U>

export type ModelField<T> = {
	loading: boolean
	error: boolean
	data: Nullable<T>
}

export type ModelState<T> = {
	setError: (error: boolean) => void
	setLoading: (loading: boolean) => void
	setData: (data: T) => void
} & ModelField<T>

export interface UseModelOptions<SORT_BY = string> extends PaginationPageSize {
	search?: string
	sort_by: SORT_BY
	sort_order: 'asc' | 'desc' | string
}

export const Gender = {
	male: 'male',
	female: 'female',
} as const

export type Gender = EnumType<typeof Gender>

export const Qualification = {
	professional: 'professional',
	skilled: 'skilled',
	enthusiast: 'enthusiast',
	beginner: 'beginner',
} as const

export type Qualification = EnumType<typeof Qualification>

export const LookType = {
	asian: 'asian',
	middle_eastern: 'middle_eastern',
	african: 'african',
	jewish: 'jewish',
	european: 'european',
	south_asian: 'south_asian',
	caucasian: 'caucasian',
	latino: 'latino',
	mixed: 'mixed',
	biracial: 'biracial',
	slavic: 'slavic',
	other: 'other',
} as const

export type LookType = EnumType<typeof LookType>

export const HairColor = {
	blonde: 'blonde',
	brunette: 'brunette',
	brown: 'brown',
	light_brown: 'light_brown',
	red: 'red',
	gray: 'gray',
	other: 'other',
} as const

export type HairColor = EnumType<typeof HairColor>

export const HairLength = {
	short: 'short',
	medium: 'medium',
	long: 'long',
	bald: 'bald',
} as const

export type HairLength = EnumType<typeof HairLength>

export const ImageType = {
	portrait: 'portrait',
	side_profile: 'side_profile',
	full_body: 'full_body',
	other: 'other',
} as const

export type ImageType = EnumType<typeof ImageType>
