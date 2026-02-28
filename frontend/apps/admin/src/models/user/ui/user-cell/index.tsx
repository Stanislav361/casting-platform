import { IconBrandTelegram } from '@tabler/icons-react'
import Link from 'next/link'
import { memo } from 'react'

import { Avatar, Flex } from '~packages/ui'

import { userName, WithUser } from '@prostoprobuy/models'
import { telegramLink } from '@prostoprobuy/toolkit'

import image from '~public/user-placeholder.png'

import styles from './index.module.scss'

export const UserCell = memo(({ user }: WithUser) => {
	return (
		<Flex gap={8} alignItems={'center'}>
			<Avatar src={user?.photo_url || image} />
			<Flex gap={2} flexDirection={'column'}>
				<div className={styles.userCell}>{userName(user)}</div>
				<Link
					className={styles.userCellLink}
					href={telegramLink(user.telegram_username)}
					target={'_blank'}
				>
					<IconBrandTelegram size={12} />
					{user.telegram_username}
				</Link>
			</Flex>
		</Flex>
	)
})
