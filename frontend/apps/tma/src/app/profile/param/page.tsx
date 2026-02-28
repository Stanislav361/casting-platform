import Page from '~widgets/page'
import { ProfileParam, ProfileSteps } from '~widgets/profile'

import { links } from '@prostoprobuy/links'

export default function ProfileParamPage() {
	return (
		<Page back={true} backUrl={links.profile.info}>
			<ProfileSteps />
			<ProfileParam />
		</Page>
	)
}
