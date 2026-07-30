/**
 * Структурное представление текста юридических документов (Пользовательское
 * соглашение, Публичная оферта) для рендера как на публичных страницах
 * /legal/agreement и /legal/offer, так и внутри экрана принятия документов.
 *
 * Содержимое сгенерировано из финальных .docx-файлов юриста один раз и
 * зафиксировано как обычный код — при выпуске новой редакции документа
 * нужно вручную обновить соответствующий *-content.ts И версию в
 * `LEGAL_DOCUMENT_VERSIONS` (см. version.ts), которая должна совпадать с
 * версией на backend (services/core/legal/documents.py).
 */
export type LegalBlockType = 'title' | 'h2' | 'h3' | 'p' | 'li' | 'table'

export interface LegalBlock {
	type: LegalBlockType
	text?: string
	rows?: string[][]
}

export type LegalDocumentType = 'user_agreement' | 'public_offer'
