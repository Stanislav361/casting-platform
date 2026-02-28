'use client'

import { memo } from 'react'

import { useUser } from '~models/user'

import { DataLoader } from '~packages/lib'
import { Avatar, Container, Flex } from '~packages/ui'

import { userName } from '@prostoprobuy/models'

import img from '~public/user-placeholder.png'

import styles from './nav.module.scss'

const NavUser = memo(props => {
	const { user } = useUser()

	return (
		<Flex alignItems={'center'} gap={10} {...props}>
			<div className={styles.navBar}>
				<Avatar src={user?.photo_url || img} size={36} />
			</div>
			<div className={styles.navText}>{userName(user)}</div>
		</Flex>
	)
})

const Nav = () => {
	const { isLoading } = useUser()

	return (
		<div className={styles.nav}>
			<Container size={'md'}>
				<Flex alignItems={'center'} justifyContent={'right'}>
					<DataLoader isLoading={isLoading} loadingFallback={''}>
						<NavUser />
					</DataLoader>
				</Flex>
			</Container>
		</div>
	)
}

export default Nav
