'use client'

import { PropsWithChildren, ReactNode, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

import { Placeholder } from '~packages/ui'

interface DataObserverLoaderProps extends PropsWithChildren {
	effector: () => void
	isLoading?: boolean
	isFetchingNext?: boolean
	hasNext?: boolean
	countData?: number
	hashError?: string | boolean
	loadingFallback?: ReactNode
	errorFallback?: ReactNode
	emptyFallback?: ReactNode
}

const DefaultLoadingFallback = () => <Placeholder />

const DefaultErrorFallback = () => <Placeholder />

const DefaultEmptyFallback = () => <Placeholder />

export function DataObserverLoader({
	effector,
	children,
	isFetchingNext,
	isLoading,
	hasNext,
	hashError,
	countData,
	loadingFallback = <DefaultLoadingFallback />,
	emptyFallback = <DefaultEmptyFallback />,
	errorFallback = <DefaultErrorFallback />,
}: DataObserverLoaderProps) {
	const { entry, inView, ref } = useInView()

	useEffect(() => {
		if (entry && inView) {
			effector()
		}
	}, [entry])

	if (isLoading) return loadingFallback

	if (hashError) return errorFallback

	if (countData <= 0 || !countData) return emptyFallback

	return (
		<>
			{children}
			{isFetchingNext
				? loadingFallback
				: hasNext && <div ref={ref} style={{ height: 32 }}></div>}
		</>
	)
}
