'use client'

import { useEffect, useState } from 'react'

import { CastingID, toCastingID } from '@prostoprobuy/models'
import { Nullable } from '@prostoprobuy/types'

import { useParsedStartParam } from './use-parsed-start-param'

export const useCastingParam = () => {
	const [id, setId] = useState<Nullable<CastingID>>(null)
	const param = useParsedStartParam()

	useEffect(() => {
		if (param?.key === 'casting') setId(toCastingID(param?.value))
	}, [param])

	return id
}
