import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

// ─── Duotone style: filled base (0.12 opacity) + crisp stroke + accent fills ──
const base = (size = 20): SVGProps<SVGSVGElement> => ({
	width: size,
	height: size,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.7,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
})

// ─── Login-page icons — DO NOT CHANGE ────────────────────────────────────────

export const IconTelegram = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M21.5 4.5L2 11.5l7 2.5m12.5-9.5L14.5 22l-5.5-8m12.5-9.5L9.5 13.5m0 0L14.5 22" />
	</svg>
)

export const IconVK = ({ size = 20, ...p }: IconProps) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
		<path d="M21.547 7h-3.29a.743.743 0 0 0-.655.392s-1.312 2.416-1.734 3.23C14.734 12.813 14 12.49 14 11.5V7.5a1 1 0 0 0-1-1h-2.24C9.68 6.5 9.5 7 9.5 7s.49-.05.745.278c.28.356.274 1.173.274 1.173s.087 2.568-.38 2.88c-.34.226-.808-.234-1.811-2.342C7.713 7.699 7.23 6.5 7.23 6.5H4.009a.5.5 0 0 0-.5.499c0 .05.007.1.02.148 0 0 1.574 4.237 3.733 6.462C9.245 15.508 11.5 15.5 11.5 15.5h1.012a.5.5 0 0 0 .488-.5v-.694a.75.75 0 0 1 1.26-.544l2.198 2.011a1 1 0 0 0 .675.26h2.629a1 1 0 0 0 .96-1.286c-.26-.876-1.637-2.25-2.37-3.036-.24-.26-.22-.387 0-.66.631-.836 2.222-3.074 2.44-4.038A.5.5 0 0 0 21.547 7z" />
	</svg>
)

export const IconMail = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<rect x="2" y="4" width="20" height="16" rx="2" />
		<polyline points="2,4 12,13 22,4" />
	</svg>
)

export const IconYandex = ({ size = 20, ...p }: IconProps) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
		<path d="M13.32 21h2.48V3h-3.55c-3.84 0-5.87 2.07-5.87 5.07 0 2.36 1.1 3.88 3.38 5.38l-3.76 7.55h2.67l4.06-8.09-1.25-.82c-1.84-1.22-2.7-2.32-2.7-4.15 0-1.9 1.26-3.16 3.26-3.16H13.32V21z" />
	</svg>
)

export const IconSmartphone = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
		<line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" />
	</svg>
)

// ─── App icons — duotone, unique, beautiful ───────────────────────────────────

// Ornate crown with gems — SuperAdmin
export const IconCrown = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M4.5 18h15L22 7l-5 4-5-8-5 8-5-4 2.5 11z" />
		<path d="M4.5 18h15L22 7l-5 4-5-8-5 8-5-4 2.5 11z" />
		<path d="M3 20.5h18" strokeWidth="2.5" strokeLinecap="round" />
		<circle cx="12" cy="3" r="1.4" fill="currentColor" stroke="none" />
		<circle cx="22" cy="7" r="1.4" fill="currentColor" stroke="none" />
		<circle cx="2" cy="7" r="1.4" fill="currentColor" stroke="none" />
	</svg>
)

// Venetian theater mask — Actor
export const IconMask = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M3 9a9 9 0 0 0 18 0V7H3v2z" />
		<path d="M3 7h18v2a9 9 0 0 1-18 0V7z" />
		<path d="M9 12.5c.4 1 1.4 1.5 3 1.5s2.6-.5 3-1.5" />
		<path d="M7 7c0-1.7 1-3.5 2.5-4.5" strokeWidth="1.3" />
		<path d="M17 7c0-1.7-1-3.5-2.5-4.5" strokeWidth="1.3" />
		<ellipse cx="9" cy="10" rx="1.5" ry="1" fill="currentColor" stroke="none" />
		<ellipse cx="15" cy="10" rx="1.5" ry="1" fill="currentColor" stroke="none" />
	</svg>
)

// Sleek briefcase with stitching — Agent
export const IconBriefcase = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M2 9h20v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
		<rect x="2" y="9" width="20" height="12" rx="2" />
		<path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		<path d="M2 14.5h20" strokeDasharray="1.5 2" strokeWidth="1.2" />
		<path d="M10 14.5v2h4v-2" />
	</svg>
)

// Clapperboard — Casting director
export const IconClipboard = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M4 6h16v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6z" />
		<rect x="4" y="6" width="16" height="16" rx="1.5" />
		<path d="M4 10h16" strokeWidth="2" />
		<path d="M4 6l3-3h10l3 3" strokeWidth="1.5" />
		<path d="M4 6l4 4M12 6l4 4" strokeWidth="1.2" />
		<path d="M8 14h8M8 17.5h5" />
	</svg>
)

// Multifaceted gem — Admin PRO
export const IconDiamond = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.15" stroke="none"
			d="M12 2l4 5H8l4-5z M2 9h20l-10 13L2 9z" />
		<path d="M2 9h20L12 22 2 9z" />
		<path d="M8 7l4 15M16 7l-4 15" strokeWidth="1" strokeOpacity="0.5" />
		<path d="M4.5 9l7.5-7 7.5 7" />
		<path d="M2 9h20" />
	</svg>
)

// Pointed star with inner glow — Starred/Favorite marker
export const IconStar = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.15" stroke="none"
			d="M12 2l2.5 6.5H21l-5.5 4 2 6.5L12 15l-5.5 4 2-6.5L3 8.5h6.5z" />
		<path d="M12 2l2.5 6.5H21l-5.5 4 2 6.5L12 15l-5.5 4 2-6.5L3 8.5h6.5z"
			strokeLinejoin="round" />
	</svg>
)

// Shield with inner emblem — Verification
export const IconShield = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M12 3L4 6.5v5c0 4.8 3.5 9.3 8 10.5 4.5-1.2 8-5.7 8-10.5V6.5L12 3z" />
		<path d="M12 3L4 6.5v5c0 4.8 3.5 9.3 8 10.5 4.5-1.2 8-5.7 8-10.5V6.5L12 3z" />
		<path d="M8.5 12l2.5 2.5 4.5-4.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Full bold heart — Favorites
export const IconHeart = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.2" stroke="none"
			d="M12 21C10 19 3 14.5 3 8.5a4.5 4.5 0 0 1 9 0 4.5 4.5 0 0 1 9 0C21 14.5 14 19 12 21z" />
		<path d="M12 21C10 19 3 14.5 3 8.5a4.5 4.5 0 0 1 9 0 4.5 4.5 0 0 1 9 0C21 14.5 14 19 12 21z" />
	</svg>
)

// Film reel — projects/films
export const IconFilm = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<rect fill="currentColor" fillOpacity="0.1" stroke="none" x="2" y="3" width="20" height="18" rx="2" />
		<rect x="2" y="3" width="20" height="18" rx="2" />
		<path d="M7 3v4M17 3v4M7 17v4M17 17v4" strokeWidth="2" />
		<path d="M2 7h20M2 17h20" />
		<circle cx="12" cy="12" r="2.5" />
		<circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
	</svg>
)

// Folders with perspective — Projects
export const IconFolder = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M3 8a2 2 0 0 1 2-2h4.5l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
		<path d="M3 8a2 2 0 0 1 2-2h4.5l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
		<path d="M3 11h18" strokeWidth="1.2" strokeOpacity="0.4" />
	</svg>
)

// Magnifier with inner cross — Search
export const IconSearch = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.1" stroke="none" cx="10.5" cy="10.5" r="7" />
		<circle cx="10.5" cy="10.5" r="7" />
		<path d="M10.5 7.5v6M7.5 10.5h6" strokeWidth="1.5" strokeOpacity="0.6" />
		<path d="M16 16l4.5 4.5" strokeWidth="2.5" strokeLinecap="round" />
	</svg>
)

// Bell with dot — Notifications
export const IconBell = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M5 13c0-3.9 3.1-7 7-7s7 3.1 7 7v2.5l1.5 2.5H3.5L5 15.5V13z" />
		<path d="M5 13a7 7 0 0 1 14 0v2l2 3H3l2-3v-2z" />
		<path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" />
		<path d="M12 3v3" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

// Gear with inner ring — Settings
export const IconSettings = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle cx="12" cy="12" r="3.5" />
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M19.4 15.6a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a2 2 0 0 1-4 0v-.2a1.5 1.5 0 0 0-1-1.3 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7A1.5 1.5 0 0 0 4.4 15H4.2a2 2 0 0 1 0-4h.2A1.5 1.5 0 0 0 5.7 10a1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1A1.5 1.5 0 0 0 9.9 5.6 1.5 1.5 0 0 0 11 4.4V4.2a2 2 0 0 1 4 0v.2a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1A1.5 1.5 0 0 0 20 10a1.5 1.5 0 0 0 1.4.9h.2a2 2 0 0 1 0 4h-.2a1.5 1.5 0 0 0-1.4.9l.4-.2z" />
		<path d="M19.4 15.6a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a2 2 0 0 1-4 0v-.2a1.5 1.5 0 0 0-1-1.3 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7A1.5 1.5 0 0 0 4.4 15H4.2a2 2 0 0 1 0-4h.2A1.5 1.5 0 0 0 5.7 10a1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1A1.5 1.5 0 0 0 9.9 5.6 1.5 1.5 0 0 0 11 4.4V4.2a2 2 0 0 1 4 0v.2a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1A1.5 1.5 0 0 0 20 10a1.5 1.5 0 0 0 1.4.9h.2a2 2 0 0 1 0 4h-.2a1.5 1.5 0 0 0-1.4.9z" />
		<circle cx="12" cy="12" r="3.5" />
		<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
	</svg>
)

// Silhouette — User
export const IconUser = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.15" stroke="none" cx="12" cy="7.5" r="4" />
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5H4z" />
		<circle cx="12" cy="7.5" r="4" />
		<path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
	</svg>
)

// Two silhouettes — Users
export const IconUsers = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.15" stroke="none" cx="9" cy="8" r="3.5" />
		<circle cx="9" cy="8" r="3.5" />
		<path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
		<path d="M16 6a3 3 0 0 1 0 6" strokeOpacity="0.7" />
		<path d="M22 20c0-3-2.5-5.3-5-5.8" strokeOpacity="0.7" />
	</svg>
)

// Bold plus — Add
export const IconPlus = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M12 4v16M4 12h16" strokeWidth="2.5" strokeLinecap="round" />
	</svg>
)

// Pen on surface — Edit
export const IconEdit = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M4 16L14.5 5.5l4 4L8 21H4v-5z" />
		<path d="M4 16L14.5 5.5l4 4L8 21H4v-5z" />
		<path d="M14.5 5.5l2-2a1.41 1.41 0 0 1 2 2l-2 2" />
		<path d="M3 21h18" strokeWidth="1.5" strokeOpacity="0.4" />
	</svg>
)

// Bin with lid open — Delete
export const IconTrash = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M5 7h14l-1.5 14H6.5L5 7z" />
		<path d="M5 7h14l-1.5 14H6.5L5 7z" />
		<path d="M3 7h18" strokeWidth="2" strokeLinecap="round" />
		<path d="M9 4h6" strokeWidth="2" strokeLinecap="round" />
		<path d="M10 11v6M14 11v6" />
	</svg>
)

// Camera with aperture — Photo
export const IconCamera = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M2 9h4l2-3h8l2 3h4v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
		<path d="M2 9h4l2-3h8l2 3h4v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
		<circle cx="12" cy="14" r="4" />
		<circle cx="12" cy="14" r="1.8" fill="currentColor" stroke="none" />
	</svg>
)

// Polaroid — Image
export const IconImage = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<rect fill="currentColor" fillOpacity="0.1" stroke="none" x="3" y="3" width="18" height="18" rx="2.5" />
		<rect x="3" y="3" width="18" height="18" rx="2.5" />
		<circle cx="8.5" cy="9" r="2" />
		<path d="M21 17L15.5 11l-4.5 4.5-2.5-2L3 17.5" strokeWidth="1.5" />
	</svg>
)

// Thick arrow back — Navigate back
export const IconArrowLeft = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.1" stroke="none" cx="12" cy="12" r="9" />
		<circle cx="12" cy="12" r="9" strokeWidth="1.2" />
		<path d="M13.5 8l-4 4 4 4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Exit door arrow — Logout
export const IconLogOut = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M4 4h7a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
		<path d="M4 4h7a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
		<path d="M16 8l4 4-4 4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
		<path d="M20 12H9" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

// Paper plane — Send
export const IconSend = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M22 2L11 13l4 9 7-20zM22 2L2 9l9 4 11-11z" />
		<path d="M22 2L2 9l9 4 2 7 9-20z" />
		<path d="M11 13L22 2" strokeWidth="1.3" strokeOpacity="0.5" />
	</svg>
)

// Chat bubble with dots — Message
export const IconMessageSquare = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M3 4h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7l-4 4V5a1 1 0 0 1 1-1z" />
		<path d="M3 4h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7l-4 4V5a1 1 0 0 1 1-1z" />
		<circle cx="8.5" cy="12" r="1" fill="currentColor" stroke="none" />
		<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
		<circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
	</svg>
)

// Perforated ticket — Verification ticket
export const IconTicket = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M2 8a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 4v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-4V8z" />
		<path d="M2 8a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 4v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-4V8z" />
		<path d="M8 7v10" strokeDasharray="2 2" strokeWidth="1.2" />
		<path d="M12 10l1.5 1.5L16 9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Bold check — Confirmed/Done
export const IconCheck = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M4 13l5 5L20 6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// X in circle — Close
export const IconX = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.2" strokeLinecap="round" />
	</svg>
)

// Spinning spokes — Loading
export const IconLoader = ({ size = 20, ...p }: IconProps) => (
	<svg
		{...base(size)}
		{...p}
		style={{ animation: 'spin 1s linear infinite', ...(p.style || {}) }}
	>
		<style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
		<circle cx="12" cy="12" r="9" strokeOpacity="0.15" />
		<path d="M12 3a9 9 0 0 1 9 9" strokeWidth="2.5" strokeLinecap="round" />
	</svg>
)

// Alert with exclamation — Error/Warning
export const IconAlertCircle = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.1" stroke="none" cx="12" cy="12" r="10" />
		<circle cx="12" cy="12" r="10" />
		<path d="M12 7v5.5" strokeWidth="2.2" strokeLinecap="round" />
		<circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none" />
	</svg>
)

// Modern receiver — Phone
export const IconPhone = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 7 7L16 14l5 2v3a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1z" />
		<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 7 7L16 14l5 2v3a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1z" />
	</svg>
)

// House with chimney — Home
export const IconHome = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M3 11.5L12 4l9 7.5V21H3V11.5z" />
		<path d="M3 11.5L12 4l9 7.5V21H3V11.5z" />
		<path d="M9 21v-7h6v7" />
		<path d="M15 6.5V4h2.5v4" strokeWidth="1.3" />
	</svg>
)

// Dashboard tiles — Grid
export const IconGrid = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<rect fill="currentColor" fillOpacity="0.15" stroke="none" x="3" y="3" width="7.5" height="7.5" rx="1.5" />
		<rect fill="currentColor" fillOpacity="0.08" stroke="none" x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
		<rect fill="currentColor" fillOpacity="0.08" stroke="none" x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
		<rect fill="currentColor" fillOpacity="0.15" stroke="none" x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
		<rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
		<rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
		<rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
		<rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
	</svg>
)

// Heartbeat line — Activity/Stats
export const IconActivity = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<polyline points="2,12 6,12 8,5 12,19 16,9 18,12 22,12"
			strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Play button in circle — Video/Play
export const IconPlayCircle = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.12" stroke="none" cx="12" cy="12" r="10" />
		<circle cx="12" cy="12" r="10" />
		<polygon fill="currentColor" stroke="none" points="10,8.5 17,12 10,15.5" />
	</svg>
)

// Circle with slash — Banned
export const IconBan = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.08" stroke="none" cx="12" cy="12" r="10" />
		<circle cx="12" cy="12" r="10" />
		<path d="M5.5 5.5l13 13" strokeWidth="2.2" strokeLinecap="round" />
	</svg>
)

// Lightning bolt — Publish/Activate
export const IconZap = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.15" stroke="none"
			d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
		<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
	</svg>
)

// Eye with lashes — View/Seen
export const IconEye = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
		<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
		<circle cx="12" cy="12" r="3" />
		<circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
	</svg>
)

// Info badge — Information
export const IconInfo = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.1" stroke="none" cx="12" cy="12" r="10" />
		<circle cx="12" cy="12" r="10" />
		<circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
		<path d="M11 11.5h1v5h1" strokeWidth="1.8" strokeLinecap="round" />
	</svg>
)

// Globe with meridians — Website
export const IconGlobe = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.08" stroke="none" cx="12" cy="12" r="10" />
		<circle cx="12" cy="12" r="10" />
		<path d="M2 12h20" strokeOpacity="0.5" />
		<ellipse cx="12" cy="12" rx="4" ry="10" strokeOpacity="0.7" />
	</svg>
)

// Modern building — Organization
export const IconBuilding = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M4 3h16v19H4z" />
		<path d="M4 3h16v19H4z" />
		<path d="M2 22h20" strokeWidth="2" strokeLinecap="round" />
		<path d="M9 22v-5h6v5" />
		<rect x="7.5" y="7" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
		<rect x="14.5" y="7" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
		<rect x="7.5" y="13" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
		<rect x="14.5" y="13" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
	</svg>
)

// Clock with minute hand — Time
export const IconClock = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.1" stroke="none" cx="12" cy="12" r="10" />
		<circle cx="12" cy="12" r="10" />
		<path d="M12 7v5l3 3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
		<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
	</svg>
)

// Medal ribbon — Award
export const IconAward = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<circle fill="currentColor" fillOpacity="0.12" stroke="none" cx="12" cy="9" r="6" />
		<circle cx="12" cy="9" r="6" />
		<circle cx="12" cy="9" r="2.5" />
		<path d="M8.21 14.21L7 22l5-3 5 3-1.21-7.79" />
	</svg>
)

// Price tag — Tag/Label
export const IconTag = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M3 11L13 3h8v8L11 21 3 11z" />
		<path d="M3 11L13 3h8v8L11 21 3 11z" />
		<circle cx="17" cy="8" r="1.5" fill="currentColor" stroke="none" />
	</svg>
)

// Chevron right — Navigate
export const IconChevronRight = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M9 18l6-6-6-6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Chevron left — Back
export const IconChevronLeft = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M15 18l-6-6 6-6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Chevron down — Dropdown
export const IconChevronDown = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M6 9l6 6 6-6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Chevron up — Collapse
export const IconChevronUp = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M18 15l-6-6-6 6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Funnel — Filter
export const IconFilter = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M3 4h18l-7 9v7l-4-2V13L3 4z" />
		<path d="M3 4h18l-7 9v7l-4-2V13L3 4z" />
	</svg>
)

// Ribbon bookmark — Save
export const IconBookmark = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.12" stroke="none"
			d="M5 3h14a1 1 0 0 1 1 1v17l-8-5-8 5V4a1 1 0 0 1 1-1z" />
		<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-5-8 5V4a1 1 0 0 1 1-1z" />
		<path d="M8 9h8" strokeOpacity="0.5" strokeWidth="1.3" />
	</svg>
)

// Document with lines — Report/File
export const IconFileText = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.1" stroke="none"
			d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z" />
		<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z" />
		<path d="M13 2v7h7" />
		<path d="M9 13h6M9 17h4" strokeWidth="1.6" />
	</svg>
)

// Sorted list with arrow — Sort
export const IconSortDesc = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path d="M11 5h9M11 9h7M11 13h5" strokeWidth="2" strokeLinecap="round" />
		<path d="M4 4v14" strokeWidth="2" strokeLinecap="round" />
		<path d="M1.5 15.5L4 18.5l2.5-3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

// Calendar page — Date
export const IconCalendar = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<rect fill="currentColor" fillOpacity="0.1" stroke="none" x="3" y="4" width="18" height="18" rx="2" />
		<rect x="3" y="4" width="18" height="18" rx="2" />
		<path d="M3 10h18" strokeWidth="1.5" />
		<path d="M8 2v4M16 2v4" strokeWidth="2" strokeLinecap="round" />
		<circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" />
		<circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
		<circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
	</svg>
)

// Pin with drop — Location
export const IconMapPin = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p}>
		<path fill="currentColor" fillOpacity="0.15" stroke="none"
			d="M12 22S4 16 4 10a8 8 0 0 1 16 0c0 6-8 12-8 12z" />
		<path d="M12 22S4 16 4 10a8 8 0 0 1 16 0c0 6-8 12-8 12z" />
		<circle cx="12" cy="10" r="3" />
		<circle cx="12" cy="10" r="1.2" fill="currentColor" stroke="none" />
	</svg>
)

export const IconRuler = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<line x1="12" y1="3" x2="12" y2="21" />
		<polyline points="8 7 12 3 16 7" />
		<polyline points="8 17 12 21 16 17" />
	</svg>
)

export const IconShirt = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M3 6l3-3 2 2a2.83 2.83 0 0 0 4 0l2-2 3 3-2 2v11H5V8L3 6z" />
	</svg>
)

export const IconShoe = ({ size = 20, ...p }: IconProps) => (
	<svg {...base(size)} {...p} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M3 17h14a2 2 0 0 0 2-2v-1l-4-5H9L3 14v3z" />
		<path d="M9 9V7a3 3 0 0 1 6 0v2" />
	</svg>
)
