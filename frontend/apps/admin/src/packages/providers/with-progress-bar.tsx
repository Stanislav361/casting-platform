'use client'

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar'
import { PropsWithChildren } from 'react'

const WithProgressBar = ({ children }: PropsWithChildren) => {
	return (
		<>
			<ProgressBar
				height='3px'
				color='var(--color-accent-primary)'
				options={{ showSpinner: false }}
			/>
			{children}
		</>
	)
}

export default WithProgressBar
