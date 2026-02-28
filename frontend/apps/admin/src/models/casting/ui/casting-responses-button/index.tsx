'use client'

import { IconUserCheck } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { Action } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { WithCastingID } from '@prostoprobuy/models'

export const CastingResponsesButton = ({
	casting,
	...rest
}: PropsWithAction<WithCastingID>) => {
	const router = useRouter()

	const handleClick = useCallback(() => {
		router.push(links.castings.responses(casting))
	}, [casting, router])

	return (
		<Action onClick={handleClick} {...rest}>
			<IconUserCheck size={18} />
			Отклики
		</Action>
	)
}
