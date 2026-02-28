import Page from '~widgets/page'
import { ProfileInfo, ProfileSteps } from '~widgets/profile'

import { links } from '@prostoprobuy/links'

export default function ProfileInfoPage() {
	return (
		<Page back={true} backUrl={links.profile.contact}>
			<ProfileSteps />
			<ProfileInfo />
		</Page>
	)
}
