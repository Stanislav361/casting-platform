import { memo } from 'react'

import { Spacing, Title } from '~packages/ui'

export const BackButton = memo(
	({ href, text = 'Назад' }: { href?: string; text?: string }) => {
		return (
			<div>
				<Title back={true} href={href}>
					{text}
				</Title>
				<Spacing v={'ml'} />
			</div>
		)
	},
)
