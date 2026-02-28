'use client'

import { IconPencil } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { Action } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { WithCastingID } from '@prostoprobuy/models'

export const CastingEditButton = ({
	casting,
	...rest
}: PropsWithAction<WithCastingID>) => {
	const router = useRouter()

	const handleClick = useCallback(() => {
		router.push(links.castings.edit(casting))
	}, [casting, router])

	return (
		<Action onClick={handleClick} {...rest} icon={<IconPencil size={18} />}>
			Изменить
		</Action>
	)
}
