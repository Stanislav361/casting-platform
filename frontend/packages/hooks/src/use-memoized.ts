import { useMemo } from 'react'

export const useMemoized = <T>(factory: () => T) => useMemo(factory, [])
