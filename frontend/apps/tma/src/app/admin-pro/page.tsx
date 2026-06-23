'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { setPendingRole } from '~/shared/pending-role'

export default function AdminProRegistrationPage() {
	const router = useRouter()

	useEffect(() => {
		setPendingRole('admin_pro')
		router.replace('/login')
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
			Открываем регистрацию Администратора PRO...
		</div>
	)
}
