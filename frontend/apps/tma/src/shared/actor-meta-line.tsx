import type { ElementType } from 'react'

import { formatAge } from './age'

type ActorMetaLineProps = {
	age?: number | string | null
	city?: string | null
	metroStation?: string | null
	fallback: string
	className?: string
	as?: ElementType
}

export function ActorMetaLine({ age, city, metroStation, fallback, className, as }: ActorMetaLineProps) {
	const Tag = as || 'span'
	const ageText = formatAge(age)
	const cityText = typeof city === 'string' ? city.trim() : ''
	const metroText = typeof metroStation === 'string' ? metroStation.trim() : ''

	if (!ageText && !cityText && !metroText) {
		return <Tag className={className}>{fallback}</Tag>
	}

	const parts: string[] = []
	if (ageText) parts.push(ageText)
	if (cityText) parts.push(cityText)
	if (metroText) parts.push(`м. ${metroText}`)

	return (
		<Tag className={className}>
			{parts.join(' · ')}
		</Tag>
	)
}
