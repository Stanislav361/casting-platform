/**
 * Тесты поиска актёров по списку.
 *
 * Поиск ломался уже дважды, и каждый раз незаметно: список просто оказывался
 * пустым, ошибок при этом нет. Здесь зафиксированы все случаи, из-за которых
 * человек не мог найти актёра — порядок слов, «ё», имя только в display_name.
 *
 * Модуль лежит в TypeScript, поэтому переводим его в JavaScript тем же
 * компилятором, что и сборка, и выполняем — отдельный тестовый раннер для этого
 * не нужен.
 *
 * Запуск: node tests/actor-search.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../src/shared/actor-search.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const loaded = { exports: {} }
new Function('exports', 'module', outputText)(loaded.exports, loaded)
const { actorSearchWords, matchesActorWords, actorDisplayName } = loaded.exports

let failures = 0
const check = (name, ok) => {
	if (!ok) failures += 1
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`)
}
const finds = (actor, query) => matchesActorWords(actor, actorSearchWords(query))

// Анкета, заполненная в приложении.
const kulik = { first_name: 'Александр', last_name: 'Кулик', city: 'Москва', metro_station: 'Сокол' }
check('находится по фамилии', finds(kulik, 'Кулик'))
check('находится по имени и фамилии', finds(kulik, 'Александр Кулик'))
check('порядок слов не важен', finds(kulik, 'Кулик Александр'))
check('лишние пробелы не мешают', finds(kulik, '  Кулик   Александр '))
check('неразрывный пробел не мешает', finds(kulik, 'Александр\u00a0Кулик'))
check('регистр не важен', finds(kulik, 'кУлИк'))
check('находится по городу', finds(kulik, 'москва'))
check('находится по станции метро', finds(kulik, 'сокол'))
check('чужая фамилия не находится', !finds(kulik, 'Петров'))
check('одно неверное слово из двух не находит', !finds(kulik, 'Александр Петров'))
check('пустой запрос показывает всех', finds(kulik, '   '))

// Перенесённая из старой базы анкета: имя только в display_name, и собран он
// в обратном порядке — «Фамилия Имя».
const migrated = { display_name: 'Кулик Александр', city: 'Москва' }
check('перенесённая анкета находится по фамилии', finds(migrated, 'Кулик'))
check('перенесённая анкета находится по имени и фамилии', finds(migrated, 'Александр Кулик'))

// «ё» и «е» — одна буква: иначе Артёма не найти по «Артем».
const artem = { first_name: 'Артём', last_name: 'Семёнов' }
check('«Артем» находит Артёма', finds(artem, 'Артем'))
check('«Артём Семенов» находит Артёма Семёнова', finds(artem, 'Артём Семенов'))

// Подпись карточки должна совпадать с тем, по чему ищем.
check('имя берётся из display_name, когда больше нечего показать',
	actorDisplayName(migrated) === 'Кулик Александр')
check('имя и фамилия важнее display_name',
	actorDisplayName({ ...migrated, first_name: 'Александр', last_name: 'Кулик' }) === 'Александр Кулик')
check('без имени показываем заглушку', actorDisplayName({}) === 'Актёр')

console.log(failures === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
