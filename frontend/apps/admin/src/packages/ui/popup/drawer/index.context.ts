'use client'

import { createContext, useContext } from 'react'

export const DrawerContext = createContext<{ onClose: () => void } | undefined>(
	undefined,
)

export const useDrawerContext = () => useContext(DrawerContext)
