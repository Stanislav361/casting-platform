export type PendingRole = 'user' | 'agent' | 'admin' | 'admin_pro'

const STORAGE_KEY = 'pp_pending_role'

export const setPendingRole = (role: PendingRole) => {
	if (typeof window === 'undefined') return
	window.localStorage.setItem(STORAGE_KEY, role)
}

export const getPendingRole = (): PendingRole | null => {
	if (typeof window === 'undefined') return null
	const value = window.localStorage.getItem(STORAGE_KEY)
	if (value === 'user' || value === 'agent' || value === 'admin' || value === 'admin_pro') {
		return value
	}
	return null
}

export const clearPendingRole = () => {
	if (typeof window === 'undefined') return
	window.localStorage.removeItem(STORAGE_KEY)
}

export const getPendingRoleLabel = (role: PendingRole | null) => {
	switch (role) {
		case 'user':
			return 'Актёр'
		case 'agent':
			return 'Агент'
		case 'admin':
			return 'Администратор кастинга'
		case 'admin_pro':
			return 'Администратор PRO'
		default:
			return ''
	}
}
