import { useInitData } from './use-init-data'

export const useStartParam = () => {
	const start_param = useInitData().start_param

	return start_param
}
