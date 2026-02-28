'use client'

import { IconEye } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { Action } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { WithCastingID } from '@prostoprobuy/models'

export const CastingViewButton = ({
	casting,
	...rest
}: PropsWithAction<WithCastingID>) => {
	const router = useRouter()

	const handleClick = useCallback(() => {
		router.push(links.castings.byId(casting))
	}, [casting, router])

	return (
		<Action onClick={handleClick} {...rest}>
			<IconEye size={18} />
			Подробнее
		</Action>
	)
}
