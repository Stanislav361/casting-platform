/**
 * Форматирует ввод телефона в маску +7 (___) ___-__-__
 * Принимает любой ввод, оставляет только цифры, формирует красивую маску.
 */
export function formatPhone(value: string): string {
	let digits = value.replace(/\D/g, '')

	if (digits.startsWith('8') && digits.length > 1) digits = '7' + digits.slice(1)
	if (digits.startsWith('7')) digits = digits.slice(1)
	if (digits.length > 10) digits = digits.slice(0, 10)

	if (digits.length === 0) return '+7 '
	if (digits.length <= 3) return `+7 (${digits}`
	if (digits.length <= 6) return `+7 (${digits.slice(0, 3)}) ${digits.slice(3)}`
	if (digits.length <= 8) return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
	return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`
}

/**
 * Извлекает чистый номер +7XXXXXXXXXX из отформатированной строки.
 *
 * Поле всегда отображается с префиксом «+7 (...)», поэтому первая цифра — это
 * код страны. Снимаем ровно один ведущий код страны (7 или 8), а остальное
 * считаем национальным номером. Это позволяет корректно удалять цифры: при
 * стирании символа номер не «съезжает» и не превращается в другой.
 */
export function rawPhone(formatted: string): string {
	let digits = formatted.replace(/\D/g, '')
	if (!digits) return ''
	if (digits[0] === '8') digits = '7' + digits.slice(1)
	if (digits[0] === '7') digits = digits.slice(1)
	digits = digits.slice(0, 10)
	return digits ? '+7' + digits : ''
}
