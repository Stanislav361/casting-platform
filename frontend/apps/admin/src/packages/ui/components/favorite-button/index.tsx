'use client'

import { IconHeartFilled } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useDeviceDetect } from '~packages/hooks'
import { Button } from '~packages/ui'

interface FavoriteButtonProps {
	href: string
	count?: number
}

export const FavoriteButton = ({ href, count }: FavoriteButtonProps) => {
	const router = useRouter()
	const { isMobile } = useDeviceDetect()

	const handleClick = useCallback(() => {
		router.replace(href)
	}, [href, router])

	return (
		<Button
			view={'brand'}
			onClick={handleClick}
			width={isMobile ? 'max' : 'auto'}
		>
			<IconHeartFilled size={18} />
			Избранное {count > 0 && `(${count})`}
		</Button>
	)
}
