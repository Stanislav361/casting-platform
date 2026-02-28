import { IconBrandTelegram } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { usePublishCasting } from '~models/casting'

import { Action } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { WithCastingID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const CastingOpenButton = ({
	casting,
	...rest
}: PropsWithAction<WithCastingID>) => {
	const req = usePublishCasting(casting)

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(undefined)
			toast.success('Кастинг опубликован')
		})
	})

	return (
		<Action onClick={handleClick} {...rest} loading={req.isPending}>
			<IconBrandTelegram size={18} />
			Опубликовать
		</Action>
	)
}
