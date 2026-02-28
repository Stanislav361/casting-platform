'use client'

import { createContext, useContext } from 'react'

export const ModalContext = createContext<{ onClose: () => void } | undefined>(
	undefined,
)

export const useModalContext = () => {
	const context = useContext(ModalContext)
	if (!context) {
		throw new Error('useModalContext must be used within a ModalProvider')
	}
	return context
}
