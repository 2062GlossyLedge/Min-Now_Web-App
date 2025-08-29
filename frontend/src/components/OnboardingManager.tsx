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
        nextStep,
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
            description = 'This is where you manage items you want to keep. You can add new items, review existing ones, and organize your belongings.'
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
                description="Start by adding one of the most important items you physically own. Click the plus (+) button to add your first item."
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

    if (onboardingStep === 'expand-item' && pathname === '/keep') {
        return (
            <Spotlight
                targetSelector="[data-onboarding='first-item-card']"
                title="Explore Your Item"
                description="Great! You've added your first item. Now click on the item card or the down arrow to expand it and see more details about your item."
                onNext={() => {
                    setShowSpotlight(false)
                    setShowExplanation(null)
                    // The next step will be triggered when the item is expanded
                }}
                onSkip={skipOnboarding}
                nextText="I'll expand it"
                skipText="Skip tutorial"
            />
        )
    }

    if (onboardingStep === 'progress-bar' && pathname === '/keep') {
        return (
            <Spotlight
                targetSelector="[data-onboarding='ownership-progress-bar']"
                title="Track Your Ownership Goal"
                description="This progress bar shows how long you've owned this item compared to your ownership goal. Hit your goal and feel satisfied for taking good care of your belonging."
                onNext={() => {
                    setShowSpotlight(false)
                    setShowExplanation(null)
                    // Move to the checkup step
                    nextStep()
                }}
                onSkip={skipOnboarding}
                nextText="Got it!"
                skipText="Skip tutorial"
            />
        )
    }

    if (onboardingStep === 'checkup' && pathname === '/keep') {
        return (
            <Spotlight
                targetSelector="[data-onboarding='checkup-button']"
                title="Time for a Checkup!"
                description="Excellent! Now try the checkup feature - it helps you review your items and decide what to keep or give away. Click the calendar icon to start your first checkup."
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
