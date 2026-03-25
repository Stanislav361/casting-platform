import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const def = (size = 20): SVGProps<SVGSVGElement> => ({
	width: size,
	height: size,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.6,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
})

// ─── Login-page icons — DO NOT CHANGE ────────────────────────────────────────

export const IconTelegram = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M21.5 4.5L2 11.5l7 2.5m12.5-9.5L14.5 22l-5.5-8m12.5-9.5L9.5 13.5m0 0L14.5 22" />
	</svg>
)

export const IconVK = ({ size = 20, ...p }: IconProps) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
		<path d="M21.547 7h-3.29a.743.743 0 0 0-.655.392s-1.312 2.416-1.734 3.23C14.734 12.813 14 12.49 14 11.5V7.5a1 1 0 0 0-1-1h-2.24C9.68 6.5 9.5 7 9.5 7s.49-.05.745.278c.28.356.274 1.173.274 1.173s.087 2.568-.38 2.88c-.34.226-.808-.234-1.811-2.342C7.713 7.699 7.23 6.5 7.23 6.5H4.009a.5.5 0 0 0-.5.499c0 .05.007.1.02.148 0 0 1.574 4.237 3.733 6.462C9.245 15.508 11.5 15.5 11.5 15.5h1.012a.5.5 0 0 0 .488-.5v-.694a.75.75 0 0 1 1.26-.544l2.198 2.011a1 1 0 0 0 .675.26h2.629a1 1 0 0 0 .96-1.286c-.26-.876-1.637-2.25-2.37-3.036-.24-.26-.22-.387 0-.66.631-.836 2.222-3.074 2.44-4.038A.5.5 0 0 0 21.547 7z" />
	</svg>
)

export const IconMail = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
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
	<svg {...def(size)} {...p}>
		<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
		<line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" />
	</svg>
)

// ─── App icons — custom & beautiful ──────────────────────────────────────────

export const IconCrown = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M2 19h20M5 19L3 7l4.5 4.5L12 3l4.5 8.5L21 7l-2 12H5z" />
		<circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
		<circle cx="3" cy="7" r="1" fill="currentColor" stroke="none" />
		<circle cx="21" cy="7" r="1" fill="currentColor" stroke="none" />
	</svg>
)

export const IconMask = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M3 9c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v3c0 4.4-3.1 8-7 8.9A2 2 0 0 1 12 21a2 2 0 0 1-2-.1C6.1 20 3 16.4 3 12V9z" />
		<path d="M9 13c.5 1.2 1.6 2 3 2s2.5-.8 3-2" />
		<circle cx="9" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
		<circle cx="15" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
	</svg>
)

export const IconBriefcase = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<rect x="2" y="8" width="20" height="13" rx="2" />
		<path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		<path d="M2 13.5h20" />
		<path d="M10 13.5v2m4-2v2" />
	</svg>
)

export const IconClipboard = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M8 3H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
		<path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3z" />
		<path d="M9 12h6M9 16h4" />
	</svg>
)

export const IconDiamond = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M7 3h10l4 6-9 12L3 9l4-6z" />
		<path d="M3 9h18" />
		<path d="M7 3l5 6m5-6l-5 6" />
	</svg>
)

export const IconStar = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M12 2l2.8 6.4 6.6.8-4.9 4.6 1.4 6.7L12 17.3l-5.9 3.2 1.4-6.7L2.6 9.2l6.6-.8L12 2z" />
	</svg>
)

export const IconShield = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M12 3L4 6v5.5c0 4.5 3.3 8.7 8 9.5 4.7-.8 8-5 8-9.5V6l-8-3z" />
		<path d="M9 12l2 2 4-4" />
	</svg>
)

export const IconHeart = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M12 21C12 21 3 14.5 3 8.5a4.5 4.5 0 0 1 9-0.5 4.5 4.5 0 0 1 9 .5C21 14.5 12 21 12 21z" />
	</svg>
)

export const IconFolder = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M3 7a2 2 0 0 1 2-2h4.2l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
	</svg>
)

export const IconFilm = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<rect x="2" y="3" width="20" height="18" rx="2" />
		<path d="M2 8h20M2 16h20M7 3v5M17 3v5M7 16v5M17 16v5" />
	</svg>
)

export const IconSearch = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="10.5" cy="10.5" r="7" />
		<path d="M16 16l4.5 4.5" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

export const IconBell = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M6 10a6 6 0 0 1 12 0c0 3.5 1.5 5.5 2 7H4c.5-1.5 2-3.5 2-7z" />
		<path d="M10 3.2A6 6 0 0 0 6 10" />
		<path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
	</svg>
)

export const IconSettings = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="12" r="3" />
		<path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

export const IconUser = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="8" r="4" />
		<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
	</svg>
)

export const IconUsers = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="9" cy="8" r="3.5" />
		<path d="M2 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
		<circle cx="17" cy="8" r="3" />
		<path d="M22 20c0-3-2.5-5.3-5-5.8" />
	</svg>
)

export const IconPlus = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

export const IconEdit = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M15.5 3.5a2.12 2.12 0 0 1 3 3L7 18H4v-3L15.5 3.5z" />
		<path d="M2 21h20" />
	</svg>
)

export const IconTrash = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
		<path d="M19 6l-1 14H6L5 6" />
		<path d="M10 11v6M14 11v6" />
	</svg>
)

export const IconCamera = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5l2-3h7l2 3H21a2 2 0 0 1 2 2z" />
		<circle cx="12" cy="13" r="4" />
		<circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" />
	</svg>
)

export const IconImage = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<rect x="3" y="3" width="18" height="18" rx="3" />
		<circle cx="8.5" cy="8.5" r="1.5" />
		<path d="M21 15l-5-5L5 21" />
	</svg>
)

export const IconArrowLeft = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M19 12H5" strokeWidth="2" strokeLinecap="round" />
		<path d="M11 6l-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconLogOut = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<path d="M16 17l5-5-5-5" strokeWidth="2" strokeLinecap="round" />
		<path d="M21 12H9" strokeWidth="1.8" strokeLinecap="round" />
	</svg>
)

export const IconSend = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M22 2L11 13" />
		<path d="M22 2L15 22l-4-9-9-4 20-7z" />
	</svg>
)

export const IconMessageSquare = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
		<path d="M8 10h8M8 14h5" />
	</svg>
)

export const IconTicket = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" />
		<path d="M9 8v8M12 10v4M15 8v8" strokeDasharray="2 2" />
	</svg>
)

export const IconCheck = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M4 13l4.5 4.5L20 6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconX = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

export const IconLoader = ({ size = 20, ...p }: IconProps) => (
	<svg
		{...def(size)}
		{...p}
		style={{ animation: 'spin 1s linear infinite', ...(p.style || {}) }}
	>
		<style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
		<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

export const IconAlertCircle = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 7v5" strokeWidth="2" strokeLinecap="round" />
		<circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
	</svg>
)

export const IconPhone = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
	</svg>
)

export const IconHome = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-10.5z" />
		<path d="M9 21V12h6v9" />
	</svg>
)

export const IconGrid = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<rect x="3" y="3" width="7" height="7" rx="1" />
		<rect x="14" y="3" width="7" height="7" rx="1" />
		<rect x="14" y="14" width="7" height="7" rx="1" />
		<rect x="3" y="14" width="7" height="7" rx="1" />
	</svg>
)

export const IconActivity = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<polyline points="22,12 18,12 15,21 9,3 6,12 2,12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconPlayCircle = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<polygon points="10,8 17,12 10,16" fill="currentColor" stroke="none" />
	</svg>
)

export const IconBan = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<line x1="5" y1="5" x2="19" y2="19" strokeWidth="2" />
	</svg>
)

export const IconZap = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M13 2L4.5 13.5H11L10 22l9-13H13z" />
	</svg>
)

export const IconEye = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
		<circle cx="12" cy="12" r="3" />
		<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
	</svg>
)

export const IconInfo = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
		<path d="M11 12h1v5h1" strokeWidth="1.8" strokeLinecap="round" />
	</svg>
)

export const IconGlobe = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="M2 12h20" />
		<path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10A15 15 0 0 1 8 12a15 15 0 0 1 4-10z" />
	</svg>
)

export const IconBuilding = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M4 22V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v18" />
		<path d="M2 22h20" />
		<path d="M9 22v-5h6v5" />
		<rect x="7" y="6" width="3" height="3" rx="0.5" />
		<rect x="14" y="6" width="3" height="3" rx="0.5" />
		<rect x="7" y="13" width="3" height="3" rx="0.5" />
		<rect x="14" y="13" width="3" height="3" rx="0.5" />
	</svg>
)

export const IconClock = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="12" r="9.5" />
		<path d="M12 7v5.5l3.5 2" strokeWidth="2" strokeLinecap="round" />
		<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
	</svg>
)

export const IconAward = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<circle cx="12" cy="9" r="6" />
		<path d="M9 15l-1.5 7 4.5-2.5 4.5 2.5L15 15" />
		<path d="M9.5 9l1.5-3 1.5 3 3 .5-2.2 2 .7 3-3-1.5L8.5 14.5l.7-3L7 9.5l3-.5z" />
	</svg>
)

export const IconTag = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M21 7.5V3h-4.5L3 16.5 7.5 21 21 7.5z" />
		<circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none" />
	</svg>
)

export const IconChevronRight = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconChevronLeft = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconChevronDown = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconChevronUp = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M18 15l-6-6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconFilter = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M4 6h16M7 12h10M10 18h4" strokeWidth="2" strokeLinecap="round" />
	</svg>
)

export const IconBookmark = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4.5L4 21V4a1 1 0 0 1 1-1z" />
	</svg>
)

export const IconFileText = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
		<path d="M13 2v7h7" />
		<path d="M9 13h6M9 17h4" />
	</svg>
)

export const IconSortDesc = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M11 5h8M11 9h6M11 13h4" strokeWidth="2" strokeLinecap="round" />
		<path d="M4 6v13M7 16l-3 3-3-3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export const IconMapPin = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<path d="M12 22S4 15.5 4 9.5a8 8 0 0 1 16 0C20 15.5 12 22 12 22z" />
		<circle cx="12" cy="9.5" r="2.5" fill="currentColor" stroke="none" />
	</svg>
)

export const IconBuilding2 = ({ size = 20, ...p }: IconProps) => (
	<svg {...def(size)} {...p}>
		<rect x="4" y="2" width="16" height="20" rx="1" />
		<path d="M9 22v-5h6v5" />
		<rect x="8" y="6" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
		<rect x="14" y="6" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
		<rect x="8" y="11" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
		<rect x="14" y="11" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
	</svg>
)
