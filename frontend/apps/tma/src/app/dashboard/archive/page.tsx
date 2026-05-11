'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardArchivePage() {
	const router = useRouter()

	useEffect(() => {
		router.replace('/dashboard/castings?archive=1')
	}, [router])

	return null
}
