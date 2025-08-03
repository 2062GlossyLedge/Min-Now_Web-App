'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton,
} from '@clerk/nextjs'

export default function Navigation() {
    const pathname = usePathname()

    const tabs = [
        { name: 'Keep', href: '/keep', icon: '↓' },
        { name: 'Give', href: '/give', icon: '↑' },
        { name: 'Gave', href: '/donated', icon: '📦' },

    ]

    return (
        <nav className="bg-white dark:bg-gray-900 shadow-sm">
            <div className="max-w-10xl mx-auto px-2 sm:px-4 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex">
                        <div className="flex space-x-2 sm:space-x-2 md:space-x-3">
                            {tabs.map((tab) => (
                                <Link
                                    key={tab.name}
                                    href={tab.href}
                                    className={`inline-flex items-center px-1 h-16 border-b-2 text-sm font-medium ${pathname === tab.href
                                        ? 'border-teal-500 text-gray-900 dark:text-gray-100'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-teal-300 dark:hover:border-teal-600 hover:text-teal-500 dark:hover:text-teal-400'
                                        }`}
                                >
                                    <span className="mr-1 text-sm">{tab.icon}</span>
                                    <span className="text-xs md:text-sm lg:text-sm">{tab.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-2 md:space-x-3">
                        {/* Settings icon - only visible when signed in */}
                        <SignedIn>
                            <Link
                                href="/settings"
                                className="text-gray-500 dark:text-gray-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors p-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </Link>
                        </SignedIn>
                        <div className="flex items-center">
                            <SignedOut>
                                {/* Container for sign in/sign up buttons with responsive sizing and spacing */}
                                <div className="flex items-center space-x-1 sm:space-x-4">
                                    {/* Sign In Button with responsive sizing */}
                                    <div className="text-xs sm:text-sm">
                                        <SignInButton />
                                    </div>
                                    {/* Sign Up Button with responsive sizing */}
                                    <div className="text-xs sm:text-sm">
                                        <SignUpButton />
                                    </div>
                                </div>
                            </SignedOut>
                            <SignedIn>
                                <UserButton />
                            </SignedIn>
                        </div>
                        {/* vertical line to demarcate button and logo */}
                        <div className="h-8 w-px bg-gray-300 dark:bg-gray-700" />
                        <Link
                            href="/landing"
                            className="relative w-8 h-8  overflow-hidden hover:opacity-80 transition-opacity duration-200 rounded"
                            title="Go to Min-Now Landing Page"
                        >
                            <Image
                                src="/Min-NowDarkLogoCropped.jpg"
                                alt="Min-Now Logo"
                                fill
                                className="object-cover"
                                sizes="32px"
                            />
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
} 