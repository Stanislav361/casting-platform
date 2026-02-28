import { IconVideo } from '@tabler/icons-react'
import { useCallback } from 'react'

import { Action } from '~packages/ui'

export const ActorSelfButton = ({
	video_intro,
	view = 'brand',
	...rest
}: PropsWithAction<{
	video_intro: string
}>) => {
	const handleClick = useCallback(() => {
		window.open(video_intro, '_blank')
	}, [video_intro])

	return (
		<Action onClick={handleClick} view={view} {...rest}>
			<IconVideo size={20} />
			Визитка
		</Action>
	)
}
