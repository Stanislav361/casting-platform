import type { ElementType } from 'react'

import { formatAge } from './age'

/**
 * Подпись под именем актёра на карточках: возраст и город.
 *
 * Станцию метро здесь намеренно не показываем — она видна только в самой
 * анкете. На карточке строка получалась слишком длинной и обрезалась, а метро
 * ещё и точнее указывает на место жительства, чем нужно в общем списке.
 */
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
