'use client'

import { useState } from 'react'

export default function HomePage() {
    const [checkupStatus, setCheckupStatus] = useState(false)

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-1">
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Welcome to Min-Now</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Select a tab above to manage your belongings
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
} 