'use client'

import { usePathname } from 'next/navigation'

export default function ConditionalMain({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    
    // Don't apply min-h-screen on the home page since it has its own styling
    if (pathname === '/') {
        return <>{children}</>
    }
    
    // Apply min-h-screen for all other pages
    return <main className="min-h-screen">{children}</main>
}
