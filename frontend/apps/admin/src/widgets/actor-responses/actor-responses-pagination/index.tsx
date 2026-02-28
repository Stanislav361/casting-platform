'use client'

import { setFilter, useActorResponsesStore } from '~widgets/actor-responses'

import { Pagination } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'

export const ActorResponsesPagination = () => {
	const { filter, count, loading } = useActorResponsesStore()

	const setPage = useMemoizedFn(page => setFilter({ page_number: page }))

	return (
		<Pagination
			total={count}
			limit={filter.page_size}
			page={filter.page_number}
			isLoading={loading}
			onPageChange={setPage}
		/>
	)
}
