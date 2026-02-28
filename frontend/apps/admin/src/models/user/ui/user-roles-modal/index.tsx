'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { useUserRoles } from '~models/user'

import { Button, Flex, Group, Modal, Spacing } from '~packages/ui'

import { Roles, RolesMap, WithUser } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'
import { ModalProps } from '@prostoprobuy/types'

export const UserRolesModal = ({
	user,
	open,
	onClose,
}: ModalProps<WithUser>) => {
	const [role, setRole] = useState<Roles>(user.role)
	const req = useUserRoles(user.id)

	useEffect(() => {
		setRole(user.role)
	}, [user.id, user.role])

	const handleRoles = async () => {
		await tryAsync(async () => {
			await req.mutateAsync(role)
			toast.success('Роль сохранена')
			onClose()
		})
	}

	return (
		<Modal open={open} onClose={onClose}>
			<Modal.Header>Назначение роли</Modal.Header>
			<Modal.Body>
				<Spacing v={'xs'} />
				<Flex gap={14} flexDirection={'column'}>
					<Flex
						alignItems={'center'}
						justifyContent={'space-between'}
						cursor={'pointer'}
						onClick={() => setRole(Roles.administrator)}
					>
						{RolesMap[Roles.administrator]}
						<input
							name={'role'}
							type={'radio'}
							value={role}
							checked={role === Roles.administrator}
							onChange={() => setRole(Roles.administrator)}
						/>
					</Flex>
					<Flex
						alignItems={'center'}
						justifyContent={'space-between'}
						cursor={'pointer'}
						onClick={() => setRole(Roles.user)}
					>
						{RolesMap[Roles.user]}
						<input
							name={'user'}
							type={'radio'}
							value={role}
							checked={role === Roles.user}
							onChange={() => setRole(Roles.user)}
						/>
					</Flex>
				</Flex>
				<Spacing v={'xs'} />
			</Modal.Body>
			<Modal.Footer>
				<Button
					view={'brand'}
					width={'max'}
					onClick={handleRoles}
					loading={req.isPending}
				>
					Сохранить
				</Button>
			</Modal.Footer>
		</Modal>
	)
}
