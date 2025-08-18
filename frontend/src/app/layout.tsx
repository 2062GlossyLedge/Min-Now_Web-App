import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './global.css'
import { ThemeProvider } from '../components/ThemeProvider'
import Navigation from '../components/Navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { ItemUpdateProvider } from '../contexts/ItemUpdateContext'
import { Toaster } from '@/components/ui/sonner'
import { HydrationWrapper } from '@/app/HydrationWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Min-Now',
    description: 'A minimalist approach to managing your belongings',
    icons: {
        icon: '/Min-NowDarkLogoCropped.ico',
    },
}


export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClerkProvider dynamic>
            <html lang="en" suppressHydrationWarning>
                <body className={inter.className}>
                    {/* HydrationWrapper mounts first, blocking all children until mounted */}
                    <HydrationWrapper>
                        <ItemUpdateProvider>
                            <ThemeProvider>
                                <Navigation />
                                <main className="min-h-screen">
                                    {children}
                                </main>
                                {/* Sonner Toaster for notifications */}
                                <Toaster />
                            </ThemeProvider>
                        </ItemUpdateProvider>
                    </HydrationWrapper>
                </body>
            </html>
        </ClerkProvider>
    )
}