import { Chip } from '~packages/ui'

import { IActor, IResponseCasting } from '@prostoprobuy/models'
import { formatYears } from '@prostoprobuy/toolkit'
import { useMemo } from 'react'

export const ActorExperience = ({
	experience,
	weight,
}: (Pick<IActor, 'experience'> | Pick<IResponseCasting, 'experience'>) & {
	weight?: boolean
}) => {

	const exp = useMemo(() => experience > 0 ? formatYears(experience) : 'Нет', [experience])

	return (
		<Chip variant={'info'} size={'md'}>
			Опыт {weight ? <b>{exp}</b> : exp}
		</Chip>
	)
}
