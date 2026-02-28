'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { SegmentedControl, SegmentedControlIItem } from '~packages/ui'

import { links } from '@prostoprobuy/links'

export type CastingsTab = 'active' | 'archive'

export interface CastingsTabProps {
	active: CastingsTab
}

export function CastingsTabs({ active }: CastingsTabProps) {
	const [tab, setTab] = useState<CastingsTab>(active)

	const router = useRouter()

	return (
		<SegmentedControl>
			<SegmentedControlIItem
				selected={tab === 'active'}
				onClick={() => router.replace(links.castings.index)}
			>
				Активные
			</SegmentedControlIItem>
			<SegmentedControlIItem
				selected={tab === 'archive'}
				onClick={() => router.replace(links.castings.archive)}
			>
				Архив
			</SegmentedControlIItem>
		</SegmentedControl>
	)
}
