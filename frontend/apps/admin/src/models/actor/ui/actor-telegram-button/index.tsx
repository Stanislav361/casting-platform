import { IconBrandTelegram } from '@tabler/icons-react'

import { Action } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { IActor } from '@prostoprobuy/models'
import { openLink } from '@prostoprobuy/toolkit'

export const ActorTelegramButton = ({
	telegram_url,
	view = 'default',
	...rest
}: PropsWithAction<Pick<IActor, 'telegram_url'>>) => {
	const handleClick = useMemoizedFn(async () => {
		openLink(telegram_url)
	})

	return (
		<Action
			onClick={handleClick}
			{...rest}
			view={view}
			icon={<IconBrandTelegram size={18} />}
		>
			Написать в Telegram
		</Action>
	)
}
