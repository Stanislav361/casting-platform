'use client'

import { Placeholder } from '@telegram-apps/telegram-ui'
import { PropsWithChildren, ReactNode, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

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

const DefaultLoadingFallback = () => (
	<Placeholder header={'Загрузка...'}></Placeholder>
)

const DefaultErrorFallback = () => (
	<Placeholder header={'Возникла ошибка'}></Placeholder>
)

const DefaultEmptyFallback = () => (
	<Placeholder header={'Нет данных'}></Placeholder>
)

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
				: hasNext && <div ref={ref}></div>}
		</>
	)
}
