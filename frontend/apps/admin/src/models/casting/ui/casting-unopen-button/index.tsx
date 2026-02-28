import { IconArchive } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useUnpublishCasting } from '~models/casting'

import { Action } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { WithCastingID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const CastingUnopenButton = ({
	casting,
	...rest
}: PropsWithAction<WithCastingID>) => {
	const req = useUnpublishCasting(casting)

	const handleClick = useMemoizedFn(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(undefined)
			toast.success('Кастинг снят с публикации')
		})
	})

	return (
		<Action onClick={handleClick} {...rest} loading={req.isPending}>
			<IconArchive size={18} />
			Снять с публикации
		</Action>
	)
}
