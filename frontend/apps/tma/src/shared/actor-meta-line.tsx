import type { CSSProperties, ElementType } from 'react'

import { getAgeParts } from './age'

type ActorMetaLineProps = {
	age?: number | string | null
	city?: string | null
	fallback: string
	className?: string
	as?: ElementType
}

const rootStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	maxWidth: '100%',
	minWidth: 0,
	whiteSpace: 'nowrap',
}

const ageStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'baseline',
	flexShrink: 0,
}

const unitStyle: CSSProperties = {
	marginLeft: 3,
}

const separatorStyle: CSSProperties = {
	flexShrink: 0,
	marginLeft: 5,
	marginRight: 5,
	opacity: 0.8,
}

const cityStyle: CSSProperties = {
	minWidth: 0,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
}

export function ActorMetaLine({ age, city, fallback, className, as }: ActorMetaLineProps) {
	const Tag = as || 'span'
	const ageParts = getAgeParts(age)
	const cityText = typeof city === 'string' ? city.trim() : ''

	if (!ageParts && !cityText) {
		return <Tag className={className}>{fallback}</Tag>
	}

	return (
		<Tag className={className} style={rootStyle}>
			{ageParts && (
				<span style={ageStyle}>
					<span>{ageParts.value}</span>
					<span style={unitStyle}>{ageParts.unit}</span>
				</span>
			)}
			{ageParts && cityText && <span style={separatorStyle}>·</span>}
			{cityText && <span style={cityStyle}>{cityText}</span>}
		</Tag>
	)
}
