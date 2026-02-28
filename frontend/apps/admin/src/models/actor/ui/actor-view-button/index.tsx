import { IconEye } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { Action } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { WithActorID } from '@prostoprobuy/models'

export const ActorViewButton = ({
	actor,
	view = 'default',
	...rest
}: PropsWithAction<WithActorID>) => {
	const router = useRouter()

	const handleClick = useCallback(() => {
		router.push(links.actors.byId(actor))
	}, [actor, router])

	return (
		<Action onClick={handleClick} view={view} {...rest}>
			<IconEye size={18} />
			Подробнее
		</Action>
	)
}
