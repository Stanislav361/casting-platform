import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const defaultProps = (size = 20): SVGProps<SVGSVGElement> => ({
	width: size,
	height: size,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.8,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
})

export const IconTelegram = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M21.5 4.5L2 11.5l7 2.5m12.5-9.5L14.5 22l-5.5-8m12.5-9.5L9.5 13.5m0 0L14.5 22" />
	</svg>
)

export const IconVK = ({ size = 20, ...p }: IconProps) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
		<path d="M21.547 7h-3.29a.743.743 0 0 0-.655.392s-1.312 2.416-1.734 3.23C14.734 12.813 14 12.49 14 11.5V7.5a1 1 0 0 0-1-1h-2.24C9.68 6.5 9.5 7 9.5 7s.49-.05.745.278c.28.356.274 1.173.274 1.173s.087 2.568-.38 2.88c-.34.226-.808-.234-1.811-2.342C7.713 7.699 7.23 6.5 7.23 6.5H4.009a.5.5 0 0 0-.5.499c0 .05.007.1.02.148 0 0 1.574 4.237 3.733 6.462C9.245 15.508 11.5 15.5 11.5 15.5h1.012a.5.5 0 0 0 .488-.5v-.694a.75.75 0 0 1 1.26-.544l2.198 2.011a1 1 0 0 0 .675.26h2.629a1 1 0 0 0 .96-1.286c-.26-.876-1.637-2.25-2.37-3.036-.24-.26-.22-.387 0-.66.631-.836 2.222-3.074 2.44-4.038A.5.5 0 0 0 21.547 7z" />
	</svg>
)

export const IconMail = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<rect x="2" y="4" width="20" height="16" rx="2" />
		<polyline points="2,4 12,13 22,4" />
	</svg>
)

export const IconMask = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M2 8c0-1.1.9-2 2-2h5c.5-2 2.5-3 5-3s4.5 1 5 3h1c1.1 0 2 .9 2 2v4c0 4-3 7-7.5 7S2 16 2 12V8z" />
		<path d="M8 12c.5 1.5 2 2 4 2s3.5-.5 4-2" />
		<circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none" />
		<circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none" />
	</svg>
)

export const IconBriefcase = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<rect x="2" y="7" width="20" height="14" rx="2" />
		<path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
		<line x1="12" y1="12" x2="12" y2="12" strokeWidth="3" />
		<path d="M2 13h20" />
	</svg>
)

export const IconClipboard = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3" />
		<rect x="9" y="2" width="6" height="4" rx="1" />
		<line x1="9" y1="12" x2="15" y2="12" />
		<line x1="9" y1="16" x2="13" y2="16" />
	</svg>
)

export const IconCrown = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M2 20h20M4 16L2 6l6 5 4-8 4 8 6-5-2 10H4z" />
	</svg>
)

export const IconStar = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2" />
	</svg>
)

export const IconDiamond = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M6 3h12l4 6-10 13L2 9z" />
		<path d="M2 9h20" />
		<path d="M6 3l4 6m4-6l4 6" />
	</svg>
)

export const IconChevronRight = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polyline points="9,18 15,12 9,6" />
	</svg>
)

export const IconChevronLeft = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polyline points="15,18 9,12 15,6" />
	</svg>
)

export const IconMapPin = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
		<circle cx="12" cy="10" r="3" />
	</svg>
)

export const IconArrowLeft = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<line x1="19" y1="12" x2="5" y2="12" />
		<polyline points="12,19 5,12 12,5" />
	</svg>
)

export const IconLogOut = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<polyline points="16,17 21,12 16,7" />
		<line x1="21" y1="12" x2="9" y2="12" />
	</svg>
)

export const IconUser = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	</svg>
)

export const IconUsers = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
		<circle cx="9" cy="7" r="4" />
		<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
		<path d="M16 3.13a4 4 0 0 1 0 7.75" />
	</svg>
)

export const IconPlus = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<line x1="12" y1="5" x2="12" y2="19" />
		<line x1="5" y1="12" x2="19" y2="12" />
	</svg>
)

export const IconEdit = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
		<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
	</svg>
)

export const IconTrash = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polyline points="3,6 5,6 21,6" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
	</svg>
)

export const IconCamera = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
		<circle cx="12" cy="13" r="4" />
	</svg>
)

export const IconImage = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<circle cx="8.5" cy="8.5" r="1.5" />
		<polyline points="21,15 16,10 5,21" />
	</svg>
)

export const IconFilm = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<rect x="2" y="2" width="20" height="20" rx="2.18" />
		<line x1="7" y1="2" x2="7" y2="22" />
		<line x1="17" y1="2" x2="17" y2="22" />
		<line x1="2" y1="12" x2="22" y2="12" />
		<line x1="2" y1="7" x2="7" y2="7" />
		<line x1="2" y1="17" x2="7" y2="17" />
		<line x1="17" y1="17" x2="22" y2="17" />
		<line x1="17" y1="7" x2="22" y2="7" />
	</svg>
)

export const IconSearch = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="11" cy="11" r="8" />
		<line x1="21" y1="21" x2="16.65" y2="16.65" />
	</svg>
)

export const IconBell = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
		<path d="M13.73 21a2 2 0 0 1-3.46 0" />
	</svg>
)

export const IconSettings = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="12" r="3" />
		<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
	</svg>
)

export const IconCheck = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polyline points="20,6 9,17 4,12" />
	</svg>
)

export const IconX = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<line x1="18" y1="6" x2="6" y2="18" />
		<line x1="6" y1="6" x2="18" y2="18" />
	</svg>
)

export const IconSend = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<line x1="22" y1="2" x2="11" y2="13" />
		<polygon points="22,2 15,22 11,13 2,9 22,2" />
	</svg>
)

export const IconMessageSquare = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
	</svg>
)

export const IconTicket = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
		<line x1="9" y1="9" x2="9" y2="9" strokeWidth="3" strokeLinecap="round" />
		<line x1="9" y1="12" x2="9" y2="12" strokeWidth="3" strokeLinecap="round" />
		<line x1="9" y1="15" x2="9" y2="15" strokeWidth="3" strokeLinecap="round" />
	</svg>
)

export const IconFolder = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
	</svg>
)

export const IconShield = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
	</svg>
)

export const IconLoader = ({ size = 20, ...p }: IconProps) => (
	<svg
		{...defaultProps(size)}
		{...p}
		style={{ animation: 'spin 1s linear infinite', ...(p.style || {}) }}
	>
		<style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
		<line x1="12" y1="2" x2="12" y2="6" />
		<line x1="12" y1="18" x2="12" y2="22" />
		<line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
		<line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
		<line x1="2" y1="12" x2="6" y2="12" />
		<line x1="18" y1="12" x2="22" y2="12" />
		<line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
		<line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
	</svg>
)

export const IconAlertCircle = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<line x1="12" y1="8" x2="12" y2="12" />
		<line x1="12" y1="16" x2="12.01" y2="16" />
	</svg>
)

export const IconPhone = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.29 6.29l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
	</svg>
)

export const IconHome = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
		<polyline points="9,22 9,12 15,12 15,22" />
	</svg>
)

export const IconGrid = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<rect x="3" y="3" width="7" height="7" />
		<rect x="14" y="3" width="7" height="7" />
		<rect x="14" y="14" width="7" height="7" />
		<rect x="3" y="14" width="7" height="7" />
	</svg>
)

export const IconActivity = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
	</svg>
)

export const IconPlayCircle = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<polygon points="10,8 16,12 10,16 10,8" />
	</svg>
)

export const IconBan = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
	</svg>
)

export const IconZap = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
	</svg>
)

export const IconEye = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
)

export const IconInfo = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round" />
		<line x1="12" y1="12" x2="12" y2="16" />
	</svg>
)

export const IconGlobe = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<line x1="2" y1="12" x2="22" y2="12" />
		<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
	</svg>
)

export const IconBuilding = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<rect x="3" y="2" width="18" height="20" rx="1" />
		<path d="M9 22V12h6v10" />
		<rect x="7" y="6" width="3" height="3" rx="0.5" />
		<rect x="14" y="6" width="3" height="3" rx="0.5" />
		<rect x="7" y="13" width="3" height="3" rx="0.5" />
		<rect x="14" y="13" width="3" height="3" rx="0.5" />
	</svg>
)

export const IconClock = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="12" r="10" />
		<polyline points="12,6 12,12 16,14" />
	</svg>
)

export const IconAward = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<circle cx="12" cy="8" r="6" />
		<path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
	</svg>
)

export const IconTag = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
		<line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" strokeLinecap="round" />
	</svg>
)

export const IconYandex = ({ size = 20, ...p }: IconProps) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
		<path d="M13.32 21h2.48V3h-3.55c-3.84 0-5.87 2.07-5.87 5.07 0 2.36 1.1 3.88 3.38 5.38l-3.76 7.55h2.67l4.06-8.09-1.25-.82c-1.84-1.22-2.7-2.32-2.7-4.15 0-1.9 1.26-3.16 3.26-3.16H13.32V21z" />
	</svg>
)

export const IconSmartphone = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
		<line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" />
	</svg>
)

export const IconHeart = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
	</svg>
)

export const IconChevronDown = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polyline points="6,9 12,15 18,9" />
	</svg>
)

export const IconChevronUp = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polyline points="18,15 12,9 6,15" />
	</svg>
)

export const IconFilter = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3" />
	</svg>
)

export const IconBookmark = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
	</svg>
)

export const IconFileText = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
		<polyline points="14,2 14,8 20,8" />
		<line x1="16" y1="13" x2="8" y2="13" />
		<line x1="16" y1="17" x2="8" y2="17" />
		<polyline points="10,9 9,9 8,9" />
	</svg>
)

export const IconSortDesc = ({ size = 20, ...p }: IconProps) => (
	<svg {...defaultProps(size)} {...p}>
		<path d="M11 5h10M11 9h7M11 13h4" />
		<path d="M3 17l3 3 3-3M6 18V4" />
	</svg>
)
