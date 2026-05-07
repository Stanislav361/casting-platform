import React, { JSXElementConstructor } from 'react'

declare global {
	type AppImageSource =
		| import('next/dist/shared/lib/get-img-props').StaticImport
		| string

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
