import { IS_DEV } from '@prostoprobuy/system'

import { useInitData } from './use-init-data'

export const useStartParam = () => {
	const start_param = useInitData().start_param

	return IS_DEV ? 'casting_39' : start_param
}
