import { apiCall } from '~/shared/api-client'

export const RESPONDENTS_PAGE_SIZE = 200
/** Страховка от бесконечного цикла, если бэкенд начнёт возвращать одну и ту же страницу. */
const RESPONDENTS_MAX_PAGES = 15

export async function fetchCastingRespondents(castingId: number) {
	const first = await apiCall(
		'GET',
		`employer/projects/${castingId}/respondents/?page=1&page_size=${RESPONDENTS_PAGE_SIZE}`,
	)
	if (!first || first.detail) {
		return { respondents: [] as any[], total: 0, projectTitle: '', error: first }
	}

	const collected = [...(first.respondents || first.items || [])]
	const total = first.total || collected.length || 0
	if (total > RESPONDENTS_PAGE_SIZE) {
		for (let page = 2; page <= RESPONDENTS_MAX_PAGES; page += 1) {
			const next = await apiCall(
				'GET',
				`employer/projects/${castingId}/respondents/?page=${page}&page_size=${RESPONDENTS_PAGE_SIZE}`,
			)
			const chunk = next?.respondents || next?.items || []
			if (chunk.length === 0) break
			collected.push(...chunk)
		}
	}

	return {
		respondents: collected,
		total,
		projectTitle: first.project_title || '',
		error: null as null,
	}
}
