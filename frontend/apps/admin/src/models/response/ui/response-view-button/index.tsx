import { IconEye } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { Action } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { ResourceType } from '@prostoprobuy/types'

export const ResponseViewButton = ({
	id,
	view = 'overlay',
	resource,
	...rest
}: PropsWithAction<{
	id: number
	resource: ResourceType
}>) => {
	const router = useRouter()

	const handleClick = useCallback(() => {
		router.push(links[resource].byId(id))
	}, [id, resource, router])

	return (
		<Action onClick={handleClick} view={view} {...rest}>
			<IconEye size={18} />
			Подробнее
		</Action>
	)
}
