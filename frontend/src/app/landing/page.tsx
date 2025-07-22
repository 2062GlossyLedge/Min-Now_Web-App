'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'

// Section data for the landing page
const sections = [
    {
        id: 1,
        title: "Track What You Own",
        content: "Min-Now helps you keep track of all your belongings. Add items with photos or emojis, categorize them, and never lose track of what you have.",
        images: [
            "/ownedItems2.png",

        ]
    },
    {
        id: 2,
        title: "Smart Organization",
        content: "Organize your items by categories like Clothing, Technology, Household Items, and more. Min-Now helps you understand your ownership patterns and usage habits.",
        images: [
            "/ownedItemExpanded3.png",

        ]
    },
    {
        id: 3,
        title: "Decide: Keep or Give",
        content: "Make mindful decisions about your belongings. Our system helps you identify items you haven't used in a while and suggests when it might be time to donate or sell them.",
        images: [
            "/itemCheckup4.png",
        ]
    },
    {
        id: 4,
        title: "Track Your Impact",
        content: "See the positive impact of your ownership habits with our badges system. Get rewarded for the more items you give away, as well as the longer you keep items you use often.",
        images: [

            "/gaveBadge2.png",
        ]
    }
]

export default function LandingPage() {
    const [currentSection, setCurrentSection] = useState(0)
    const [isVisible, setIsVisible] = useState(true)

    // Handle section transitions with fade effect
    const goToSection = (index: number) => {
        setIsVisible(false)
        setTimeout(() => {
            setCurrentSection(index)
            setIsVisible(true)
        }, 300)
    }

    const nextSection = () => {
        if (currentSection < 4) {
            goToSection(currentSection + 1)
        }
    }

    const prevSection = () => {
        if (currentSection > 0) {
            goToSection(currentSection - 1)
        }
    }

    // Auto-advance sections every 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (currentSection < 4) {
                nextSection()
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [currentSection])

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-400 via-teal-500 to-teal-600 dark:from-teal-600 dark:via-teal-700 dark:to-teal-800 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-white/10 dark:bg-black/20" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-transparent via-transparent to-white/5 dark:to-black/10" />

            {/* Header with logo and navigation */}
            <header className="relative z-10 p-6">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-lg">
                            <Image
                                src="/Min-NowDarkLogoCropped.jpg"
                                alt="Min-Now Logo"
                                fill
                                className="object-cover"
                                sizes="48px"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Min-Now</h1>
                    </div>
                    <Link
                        href="/keep"
                        className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-full transition-all duration-300 backdrop-blur-sm border border-white/20"
                    >
                        Go to App
                    </Link>
                </div>
            </header>

            {/* Main content area */}
            <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
                {/* Progress indicators */}
                <div className="flex justify-center mb-12">
                    <div className="flex space-x-3">
                        {[0, 1, 2, 3, 4].map((index) => (
                            <button
                                key={index}
                                onClick={() => goToSection(index)}
                                className={`w-3 h-3 rounded-full transition-all duration-300 ${currentSection === index
                                    ? 'bg-white shadow-lg scale-125'
                                    : 'bg-white/40 hover:bg-white/60'
                                    }`}
                                aria-label={`Go to section ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content sections */}
                <div className="min-h-[500px] flex items-center justify-center">
                    {currentSection < 4 ? (
                        <div className={`transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'} w-full`}>
                            <div className="grid lg:grid-cols-2 gap-12 items-center">
                                {/* Text content */}
                                <div className="text-center lg:text-left">
                                    <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                                        {sections[currentSection].title}
                                    </h2>
                                    <p className="text-xl text-white/90 leading-relaxed">
                                        {sections[currentSection].content}
                                    </p>
                                </div>

                                {/* Images */}
                                <div className="flex flex-wrap gap-4 justify-center lg:justify-end">
                                    {sections[currentSection].images.map((image, index) => (
                                        <div
                                            key={index}
                                            className="relative w-96 h-72 lg:w-[600px] lg:h-[400px] rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-sm border border-white/20"
                                        >
                                            <Image
                                                src={image}
                                                alt={`Screenshot ${index + 1} for ${sections[currentSection].title}`}
                                                fill
                                                className="object-contain"
                                                sizes="(max-width: 1024px) 288px, 400px"
                                            />

                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Sign up section
                        <div className={`transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'} w-full text-center`}>
                            <div className="max-w-3xl mx-auto">
                                <div className="mb-8">
                                    <UserPlus className="w-16 h-16 text-white mx-auto mb-6" />
                                    <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                                        Ready to Start Your Minimalist Journey?
                                    </h2>
                                    <p className="text-xl text-white/90 mb-8 leading-relaxed">
                                        Join the users who have simplified their lives with Min-Now.
                                        Start tracking your belongings, make mindful decisions, and discover the
                                        freedom of minimalism.
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                    <Link
                                        href="/keep"
                                        className="bg-white text-teal-600 hover:bg-white/90 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                                    >
                                        Get Started Free
                                    </Link>
                                    {/* <Link
                                        href="/keep"
                                        className="bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 backdrop-blur-sm border border-white/20"
                                    >
                                        View Demo
                                    </Link> */}
                                </div>

                                <div className="mt-8 text-white/70 text-sm">
                                    No credit card required • Get started in 2 minutes
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation buttons */}
                <div className="flex justify-between items-center mt-12">
                    <button
                        onClick={prevSection}
                        disabled={currentSection === 0}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-full transition-all duration-300 ${currentSection === 0
                            ? 'opacity-50 cursor-not-allowed'
                            : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/20'
                            }`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Previous</span>
                    </button>

                    <button
                        onClick={nextSection}
                        disabled={currentSection === 4}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-full transition-all duration-300 ${currentSection === 4
                            ? 'opacity-50 cursor-not-allowed'
                            : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/20'
                            }`}
                    >
                        <span>Next</span>
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 text-center text-white/70 py-1">
                <p>&copy; 2025 Min-Now. Simplify your life, one item at a time.</p>
            </footer>
        </div>
    )
}
