import { Placeholder } from '@telegram-apps/telegram-ui'
import { PropsWithChildren, ReactNode } from 'react'
import { match } from 'ts-pattern'

interface DataLoaderProps extends PropsWithChildren {
	isLoading: boolean
	hasError?: boolean
	countData?: number | string
	loadingFallback?: ReactNode
	errorFallback?: ReactNode
	emptyFallback?: ReactNode
}

const DefaultLoadingFallback = () => <Placeholder />

const DefaultErrorFallback = () => <Placeholder />

const DefaultEmptyFallback = () => <Placeholder />

export const DataLoader = ({
	isLoading = true,
	hasError = false,
	countData,
	children,
	loadingFallback = <DefaultLoadingFallback />,
	errorFallback = <DefaultErrorFallback />,
	emptyFallback = <DefaultEmptyFallback />,
}: DataLoaderProps) => {
	return match({ isLoading, hasError, countData })
		.with({ isLoading: true }, () => loadingFallback)
		.with({ hasError: true }, () => errorFallback)
		.with({ countData: 0 }, () => emptyFallback)
		.otherwise(() => children)
}
