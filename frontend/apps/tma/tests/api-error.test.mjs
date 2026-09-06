/**
 * Тесты разбора ошибки от бэкенда (src/shared/api-error.ts).
 *
 * Зачем. Бэкенд сообщает об ошибке тремя разными способами, а экраны разбирали
 * только два. Из-за этого любая ошибка проверки схемы — массив FastAPI — теряла
 * текст и превращалась в общее «Ошибка при создании профиля». Человек видел, что
 * не получилось, но не то, какое поле поправить: именно так клиент с битым email
 * в аккаунте не смог завести анкету и пошёл в поддержку.
 *
 * Модуль лежит в TypeScript, поэтому переводим его в JavaScript тем же
 * компилятором, что и сборка, и выполняем — отдельный тестовый раннер не нужен.
 *
 * Запуск: node tests/api-error.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../src/shared/api-error.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const loaded = { exports: {} }
new Function('exports', 'module', outputText)(loaded.exports, loaded)
const { apiErrorMessage } = loaded.exports

let failures = 0
const check = (name, ok) => {
	if (!ok) failures += 1
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`)
}

const FALLBACK = 'Ошибка при создании профиля'
const msg = (response) => apiErrorMessage(response, FALLBACK)

// ─── Ошибка проверки схемы: массив FastAPI ───

// Ровно тот случай, из-за которого клиент застрял: email из аккаунта сохранён
// без «@», анкета не создаётся, а причина до человека не доходила.
const emailError = {
	detail: [
		{
			type: 'value_error',
			loc: ['body', 'email'],
			msg: 'Value error, Проверьте email — нужен вид name@example.com. Похоже, пропущен знак @ или домен.',
			input: 'kolosovskiymisha1gmail.com',
		},
	],
}
check('текст ошибки про email доходит до человека', msg(emailError).includes('Проверьте email'))
check('служебный префикс pydantic убран', !msg(emailError).includes('Value error'))
check('подсказан правильный вид адреса', msg(emailError).includes('name@example.com'))
check('это не общая заглушка', msg(emailError) !== FALLBACK)

// Стандартный текст pydantic сам не говорит, о каком поле речь, — подписываем.
const missingField = {
	detail: [{ type: 'missing', loc: ['body', 'height'], msg: 'Field required' }],
}
check('к стандартному тексту добавлено имя поля', msg(missingField) === 'Рост: Field required')

// Своё сообщение уже объясняет, что делать: подпись поля к нему только мешает.
const ownMessage = {
	detail: [{ type: 'value_error', loc: ['body', 'email'], msg: 'Value error, Проверьте email' }],
}
check('к своему сообщению подпись поля не добавляется', msg(ownMessage) === 'Проверьте email')

// Человек должен увидеть все проблемы сразу, а не править их по одной.
const twoErrors = {
	detail: [
		{ type: 'missing', loc: ['body', 'height'], msg: 'Field required' },
		{ type: 'missing', loc: ['body', 'shoe_size'], msg: 'Field required' },
	],
}
check('показаны обе проблемы', msg(twoErrors).split('\n').length === 2)
check('первая проблема названа', msg(twoErrors).includes('Рост'))
check('вторая проблема названа', msg(twoErrors).includes('Размер обуви'))

const duplicated = {
	detail: [
		{ type: 'missing', loc: ['body', 'height'], msg: 'Field required' },
		{ type: 'missing', loc: ['body', 'height'], msg: 'Field required' },
	],
}
check('одинаковые сообщения не дублируются', msg(duplicated).split('\n').length === 1)

// ─── Прежние формы ответа продолжают работать ───

check('detail строкой', msg({ detail: 'Этот email уже используется' }) === 'Этот email уже используется')
check(
	'detail объектом {message}',
	msg({ detail: { code: 'messenger_required', message: 'Укажите способ связи' } }) ===
		'Укажите способ связи',
)
check('message на верхнем уровне', msg({ message: 'Слишком много попыток' }) === 'Слишком много попыток')
check('ответ строкой', msg('Сервер недоступен') === 'Сервер недоступен')

// ─── Когда показывать нечего — заглушка ───

check('пустой ответ', msg(null) === FALLBACK)
check('ответ без detail', msg({}) === FALLBACK)
check('detail пустым массивом', msg({ detail: [] }) === FALLBACK)
check('detail пустой строкой', msg({ detail: '   ' }) === FALLBACK)
check('detail без msg', msg({ detail: [{ loc: ['body', 'email'] }] }) === FALLBACK)
check('detail с пустым msg', msg({ detail: [{ msg: '  ', loc: ['body'] }] }) === FALLBACK)
check('detail числом', msg({ detail: 42 }) === FALLBACK)

// Ошибка не в поле тела, а в параметре запроса — служебные части loc пропускаем.
check(
	'имя поля берётся не из служебной части loc',
	msg({ detail: [{ type: 'missing', loc: ['query', 'city'], msg: 'Field required' }] }) ===
		'Город: Field required',
)
// У вложенного поля индекс элемента списка не должен подменять имя поля.
check(
	'индекс списка не считается именем поля',
	msg({ detail: [{ type: 'missing', loc: ['body', 'height', 0], msg: 'Field required' }] }) ===
		'Рост: Field required',
)

console.log(failures === 0 ? '\nВсе проверки пройдены.' : `\nНе прошло проверок: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
