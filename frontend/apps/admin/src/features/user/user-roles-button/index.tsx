import { IconEdit } from '@tabler/icons-react'

import { UserRolesModal } from '~models/user'

import { Button, Chip, Flex } from '~packages/ui'

import { useModal } from '@prostoprobuy/hooks'
import { RolesMap, WithUser } from '@prostoprobuy/models'

export const UserRolesButton = ({ user }: WithUser) => {
	const { toggle, isOpen, close } = useModal()

	return (
		<>
			{open && (
				<UserRolesModal user={user} open={isOpen} onClose={close} />
			)}

			<Flex gap={8} alignItems={'center'}>
				<Chip variant={'brand-overlay'}>{RolesMap[user.role]}</Chip>
				<Button
					onClick={toggle}
					height={24}
					long={30}
					radius={'sm'}
					size={'circle'}
					view={'brand-overlay'}
				>
					<IconEdit size={16} />
				</Button>
			</Flex>
		</>
	)
}
