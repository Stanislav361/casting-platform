import { BASE_ROOT_URL } from '@prostoprobuy/system'

type LinkId = string | number

export const modelLinksFactory = (entity: LinkId) => {
	const base = `${BASE_ROOT_URL}${entity}`
	return {
		get index() {
			return base
		},
		get create() {
			return `${base}/create`
		},
		edit(id: LinkId) {
			return `${base}/${id}/edit`
		},
		byId(id: LinkId, params: string = '') {
			return `${base}/${id}?${params}`
		},
	}
}

export const links = {
	get root() {
		return BASE_ROOT_URL
	},

	get home() {
		return this.root
	},

	get notFound() {
		return `${this.root}not-found`
	},

	get alert() {
		return `${this.root}alert`
	},

	get error() {
		return `${this.root}error`
	},

	get accessDenied() {
		return `${this.root}access-denied`
	},

	get login() {
		return `${this.root}login`
	},

	get register() {
		return `${this.root}register`
	},

	get logout() {
		return `${this.root}logout`
	},

	get dashboard() {
		return `${this.root}dashboard`
	},

	profile: {
		get index() {
			return `${BASE_ROOT_URL}profile`
		},
		get contact() {
			return `${this.index}/contact`
		},
		get info() {
			return `${this.index}/info`
		},
		get param() {
			return `${this.index}/param`
		},
		get self() {
			return `${this.index}/self`
		},
		get form() {
			return `${this.index}/form`
		},
	},

	actors: modelLinksFactory('actors'),

	reports: {
		...modelLinksFactory('reports'),
		actors(id: LinkId) {
			return `${BASE_ROOT_URL}reports/${id}/actors`
		},
		favorites(id: LinkId) {
			return `${BASE_ROOT_URL}reports/${id}/favorites`
		},
		ref: (id: LinkId) => ({
			get index() {
				return `${BASE_ROOT_URL}public/reports/${id}`
			},
			get favorites() {
				return `${BASE_ROOT_URL}public/reports/${id}/favorites`
			},
		}),
	},

	projects: modelLinksFactory('projects'),

	users: modelLinksFactory('users'),

	negotiations: modelLinksFactory('negotiations'),

	castings: {
		...modelLinksFactory('castings'),
		get archive() {
			return `${BASE_ROOT_URL}castings/archive`
		},
		responses(id: LinkId) {
			return `${BASE_ROOT_URL}castings/${id}/responses`
		},
		form(id: LinkId) {
			return `${BASE_ROOT_URL}form/${id}`
		},
	},
}
