'use client'

import AlertError from '~widgets/alert-error'
import AlertNotFound from '~widgets/alert-not-found'
import Casting from '~widgets/casting'
import Page from '~widgets/page'

import { useCasting, useCastingStore } from '~models/casting'

import { DataLoader, Show } from '~packages/lib'
import { Loader } from '~packages/ui'

export default function ProfileFormPage() {
	const { casting } = useCastingStore()
	const { isLoading, isError, data } = useCasting(casting)

	return (
		<DataLoader
			isLoading={isLoading}
			hasError={isError}
			errorFallback={
				<Page>
					<AlertError />
				</Page>
			}
			loadingFallback={<Loader />}
		>
			<Show when={casting} fallback={<AlertNotFound />}>
				<Page>
					<Casting casting={data?.data} />
				</Page>
			</Show>
		</DataLoader>
	)
}
