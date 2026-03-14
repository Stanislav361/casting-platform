'use client'

import { Toaster } from 'react-hot-toast'

export const ToasterProvider = () => (
	<Toaster
		position="top-center"
		toastOptions={{
			style: {
				background: '#1a1a1a',
				color: '#fff',
				border: '1px solid #333',
				borderRadius: 10,
				fontSize: 14,
			},
			success: { duration: 3000, iconTheme: { primary: '#f5c518', secondary: '#000' } },
			error: { duration: 5000 },
		}}
	/>
)
