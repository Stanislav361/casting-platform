import React, {
	type ChangeEvent,
	type JSXElementConstructor,
	PropsWithChildren,
	ReactNode,
} from 'react'

declare module '*.css'
declare module '*.scss'
declare module '*.sass'

declare global {
	type ImageData =
		| import('next/dist/shared/lib/get-img-props').StaticImport
		| string

	type Size = 'sm' | 'md' | 'lg'

	type ButtonRadius = Size & 'cr'

	type ButtonView =
		| 'default'
		| 'primary'
		| 'secondary'
		| 'black'
		| 'danger'
		| 'overlay'
		| 'brand'
		| 'brand-overlay'

	type ButtonWidth = 'auto' | 'max'

	type ChipVariant =
		| 'default'
		| 'info'
		| 'flat'
		| 'primary'
		| 'success'
		| 'warning'
		| 'danger'
		| 'tiny'
		| 'black'
		| 'gray'
		| 'brand-overlay'

	type InputEvent = ChangeEvent<HTMLInputElement>

	type SelectEvent = ChangeEvent<HTMLSelectElement>

	type MenuItem = {
		name: string
		ico: ImageData
		href: string
		variant?: 'active' | 'disabled' | 'default'
		actions?: Partial<MenuItem>[]
		disabled?: boolean
	}

	type PropsWithAction<P = unknown> = P &
		PropsWithChildren & {
			view?: ButtonView
			radius?: ButtonRadius
			trigger?: () => void
			width?: ButtonWidth
			hideIcon?: boolean
			onlyIcon?: boolean
			disabled?: boolean
			loading?: boolean
			selected?: boolean
			onClick?: (e?: any) => void
			icon?: ReactNode
		}

	interface ReactElement<
		P = any,
		T extends string | JSXElementConstructor<any> =
			| string
			| JSXElementConstructor<any>,
	> {
		type: T
		props: P
		key: string | null
	}

	namespace JSX {
		interface Element extends React.ReactElement<any, any> {}
	}
}

export {}
