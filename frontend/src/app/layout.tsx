import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './global.css'
import { ThemeProvider } from '../components/ThemeProvider'
import ConditionalNavigation from '@/components/landing/ConditionalNavigation'
import ConditionalMain from '@/components/landing/ConditionalMain'
import { ClerkProvider } from '@clerk/nextjs'
import { ItemUpdateProvider } from '../contexts/ItemUpdateContext'
import { OnboardingProvider } from '../contexts/OnboardingContext'
import { CheckupProvider } from '../contexts/CheckupContext'
import { Toaster } from '@/components/ui/sonner'
import { HydrationWrapper } from '@/app/HydrationWrapper'
import OnboardingManager from '@/components/onboarding/OnboardingManager'

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
                        <OnboardingProvider>
                            <ItemUpdateProvider>
                                <CheckupProvider>
                                    <ThemeProvider>
                                        <ConditionalNavigation />

                                        {children}

                                        {/* Onboarding Manager for tutorial spotlights */}
                                        <OnboardingManager />
                                        {/* Sonner Toaster for notifications */}
                                        <Toaster />
                                    </ThemeProvider>
                                </CheckupProvider>
                            </ItemUpdateProvider>
                        </OnboardingProvider>
                    </HydrationWrapper>
                </body>
            </html>
        </ClerkProvider>
    )
}