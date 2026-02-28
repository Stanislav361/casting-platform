import Page from '~widgets/page'
import { ProfileSelf, ProfileSteps } from '~widgets/profile'

import { links } from '@prostoprobuy/links'

export default function ProfileSelfPage() {
	return (
		<Page back={true} backUrl={links.profile.param}>
			<ProfileSteps />
			<ProfileSelf />
		</Page>
	)
}
