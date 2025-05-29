import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './global.css'
import { ThemeProvider } from '../components/ThemeProvider'
import Navigation from '../components/Navigation'
import { ClerkProvider } from '@clerk/nextjs'

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
        <ClerkProvider>
            <html lang="en" suppressHydrationWarning>
                <body className={`${inter.className} bg-white dark:bg-black`}>

                    <ThemeProvider>
                        <Navigation />
                        <main className="min-h-screen">
                            {children}
                        </main>
                    </ThemeProvider>
                </body>
            </html>
        </ClerkProvider>
    )
}