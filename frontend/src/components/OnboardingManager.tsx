'use client'

import { useOnboarding } from '@/contexts/OnboardingContext'
import Spotlight from './Spotlight'
import OnboardingExplanation from './OnboardingExplanation'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function OnboardingManager() {
    const { 
        isOnboarding, 
        onboardingStep, 
        skipOnboarding, 
        showSpotlight,
        setShowSpotlight,
        showExplanation,
        setShowExplanation
    } = useOnboarding()
    
    const pathname = usePathname()

    // Hide spotlight when navigating between pages
    useEffect(() => {
        setShowSpotlight(false)
        
        // Show spotlight again after navigation completes
        const timer = setTimeout(() => {
            if (isOnboarding) {
                setShowSpotlight(true)
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [pathname, isOnboarding, setShowSpotlight])

    if (!isOnboarding) {
        return null
    }

    // Show explanation if it's set
    if (showExplanation) {
        let title = ''
        let description = ''
        
        if (showExplanation === 'keep-page') {
            title = 'Welcome to Keep Items!'
            description = 'This is where you manage items you want to keep. You can add new items, review existing ones, and organize your belongings. The Keep section helps you track what you own and when you last used each item.'
        } else if (showExplanation === 'checkup-complete') {
            title = 'Checkup Complete!'
            description = 'Great job! You\'ve completed your first checkup. Checkups help you regularly review your items and decide what to keep, give away, or donate. This helps maintain a minimalist lifestyle and ensures you only keep what truly adds value to your life.'
        }

        return (
            <OnboardingExplanation
                title={title}
                description={description}
                onContinue={() => setShowExplanation(null)}
            />
        )
    }

    if (!showSpotlight) {
        return null
    }

    if (onboardingStep === 'add-item' && pathname === '/keep') {
        return (
            <Spotlight
                targetSelector="[data-onboarding='add-item-button']"
                title="Add Your First Item"
                description="Start by adding an item you want to keep track of. Click the plus (+) button to add your first item and see how Min-Now helps you manage your belongings."
                onNext={() => {
                    setShowSpotlight(false)
                    setShowExplanation(null)
                    // The next step will be triggered when an item is actually added
                }}
                onSkip={skipOnboarding}
                nextText="I'll add an item"
                skipText="Skip tutorial"
            />
        )
    }

    if (onboardingStep === 'checkup' && pathname === '/keep') {
        return (
            <Spotlight
                targetSelector="[data-onboarding='checkup-button']"
                title="Time for a Checkup!"
                description="Great! You've added an item. Now try the checkup feature - it helps you review your items and decide what to keep or give away. Click the calendar icon to start your first checkup."
                onNext={() => {
                    setShowSpotlight(false)
                    setShowExplanation(null)
                    // The onboarding will complete when checkup is finished
                }}
                onSkip={skipOnboarding}
                nextText="I'll do a checkup"
                skipText="Skip tutorial"
            />
        )
    }

    return null
}
