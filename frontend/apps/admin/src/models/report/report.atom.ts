import { IProducerReport } from '@prostoprobuy/models'
import { createFetcherModelApi } from '@prostoprobuy/toolkit'

export const {
	setData: setProducerReport,
	setLoading: setProducerReportLoading,
	setError: setProducerReportError,
	$store: $producerReport,
} = createFetcherModelApi<IProducerReport>({
	error: false,
	loading: true,
	data: null,
})
