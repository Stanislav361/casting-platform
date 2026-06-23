'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminRegistrationPage() {
	const router = useRouter()

	useEffect(() => {
		router.replace('/login?admin=1')
	}, [router])

	return (
		<div style={{
			minHeight: '100vh',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			background: '#0b0b0f',
			color: '#f5c518',
			fontWeight: 700,
			padding: 24,
			textAlign: 'center',
		}}>
			Открываем регистрацию администратора...
		</div>
	)
}
