import { IconEye } from '@tabler/icons-react'

import { RefActorModal } from '~models/report'

import { Action } from '~packages/ui'

import { useModal } from '@prostoprobuy/hooks'
import { WithActorID } from '@prostoprobuy/models'

export const RefActorModalButton = ({ actor }: WithActorID) => {
	const { toggle, isOpen } = useModal()

	return (
		<>
			{isOpen && (
				<RefActorModal open={isOpen} onClose={toggle} actor={actor} />
			)}

			<Action
				width={'max'}
				view={'brand'}
				icon={<IconEye size={20} />}
				onClick={toggle}
			>
				Посмотреть
			</Action>
		</>
	)
}
