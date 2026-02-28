import { Avatar, Cell } from '@telegram-apps/telegram-ui'
import { memo } from 'react'

import { useInitData } from '~packages/hooks'
import { Flex } from '~packages/ui'

const Header = memo(() => {
	const { user } = useInitData()

	return (
		<Flex alignItems={'center'} justifyContent={'space-between'}>
			<Cell
				style={{ width: '100%' }}
				before={<Avatar size={40} src={user?.photo_url} />}
				description={'Давайте подберём роль вместе!'}
			>
				Привет, {user?.username || 'дорогой пользователь'}!
			</Cell>
		</Flex>
	)
})

export default Header
