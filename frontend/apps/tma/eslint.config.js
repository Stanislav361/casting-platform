import { nextJsConfig } from '@prostoprobuy/eslint-config/next-js'

/** @type {import('eslint').Linter.Config} */
export default [
	...nextJsConfig,
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@next/next/no-img-element': 'off',
			'no-empty': 'off',
			'react/display-name': 'off',
			'react/jsx-key': 'off',
			'react-hooks/exhaustive-deps': 'off',
			'turbo/no-undeclared-env-vars': 'off',
		},
	},
]
