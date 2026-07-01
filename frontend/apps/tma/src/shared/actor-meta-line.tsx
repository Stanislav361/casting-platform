import type { ElementType } from 'react'

import { formatAge } from './age'

type ActorMetaLineProps = {
	age?: number | string | null
	city?: string | null
	fallback: string
	className?: string
	as?: ElementType
}

export function ActorMetaLine({ age, city, fallback, className, as }: ActorMetaLineProps) {
	const Tag = as || 'span'
	const ageText = formatAge(age)
	const cityText = typeof city === 'string' ? city.trim() : ''

	if (!ageText && !cityText) {
		return <Tag className={className}>{fallback}</Tag>
	}

	const parts: string[] = []
	if (ageText) parts.push(ageText)
	if (cityText) parts.push(cityText)

	return (
		<Tag className={className}>
			{parts.join(' · ')}
		</Tag>
	)
}
