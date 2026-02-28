import { useMemo } from 'react'

import { useStartParam } from '~packages/hooks/use-start-param'

import { parseStartParam, StartParam } from '@prostoprobuy/toolkit'

export const useParsedStartParam = (): StartParam => {
	const start_param = useStartParam()

	return useMemo(() => parseStartParam(start_param), [start_param])
}
