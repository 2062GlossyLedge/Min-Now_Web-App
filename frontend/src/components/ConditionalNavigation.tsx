'use client'

import { usePathname } from 'next/navigation'
import Navigation from './Navigation'

export default function ConditionalNavigation() {
    const pathname = usePathname()

    // Don't show navigation on the home page (landing page)
    if (pathname === '/') {
        return null
    }

    // Show navigation for all other pages
    return <Navigation />
}
