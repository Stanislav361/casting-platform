'use client'

import { useRouter } from 'next/navigation'
import { PropsWithChildren, useCallback, useEffect } from 'react'
import { backButton } from '@telegram-apps/sdk-react'

import { useSafeSwipeable } from '~packages/hooks'
import { TopPadding } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { IS_CLIENT } from '@prostoprobuy/system'

import styles from './page.module.scss'

interface PageProps extends PropsWithChildren {
	back?: boolean
	backUrl?: string
}

export default function Page({ back, backUrl, children }: PageProps) {
	const router = useRouter()

	const handleBackClick = useCallback(() => {
		if (backUrl) router.replace(backUrl)
		else router.back()
	}, [backUrl, router])

	useEffect(() => {
		try {
			if (!backButton?.isMounted?.()) return
			if (back) {
				backButton.show()
				return backButton.onClick(handleBackClick)
			}
			backButton.hide()
		} catch {
			// TG SDK not available in browser mode
		}
	}, [back, handleBackClick])

	const onSwipedRight = useMemoizedFn(eventData => {
		if (eventData.initial[0] <= 30) {
			handleBackClick()
		}
	})

	const onSwipedLeft = useMemoizedFn(eventData => {
		if (!IS_CLIENT) return
		if (eventData.initial[0] >= window.innerWidth - 30) {
			handleBackClick()
		}
	})

	const swiper = useSafeSwipeable({
		onSwipedRight,
		onSwipedLeft,
		delta: 20,
		preventScrollOnSwipe: false,
		trackTouch: true,
	})

	return (
		<main className={styles.page} {...swiper}>
			<TopPadding />
			{children}
		</main>
	)
}
