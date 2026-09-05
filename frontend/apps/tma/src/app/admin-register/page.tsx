'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { markAdminRegistration } from '~/shared/admin-registration'

/**
 * Постоянная ссылка на регистрацию администраторов.
 *
 * В отличие от /login?admin=1 здесь нет параметров адреса, а значит нечему
 * теряться: ни при возврате из внешнего входа, ни при запуске установленного
 * приложения, ни когда service worker отдаёт страницу из кеша. Признак админской
 * регистрации ставим до перехода — дальше на него опираются экран входа и выбор
 * роли (см. shared/admin-registration.ts).
 */
export default function AdminRegistrationPage() {
	const router = useRouter()

	useEffect(() => {
		markAdminRegistration()
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
