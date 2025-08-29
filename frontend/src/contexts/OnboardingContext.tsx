'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

interface OnboardingContextType {
    isOnboarding: boolean
    onboardingStep: 'add-item' | 'expand-item' | 'progress-bar' | 'checkup' | 'checkup-review' | 'checkup-submit' | 'email-signup' | 'completed'
    startOnboarding: () => void
    skipOnboarding: () => void
    nextStep: () => void
    completeOnboarding: () => void
    showSpotlight: boolean
    setShowSpotlight: (show: boolean) => void
    showExplanation: string | null
    setShowExplanation: (explanation: string | null) => void
    hasCompletedTutorial: boolean
    tutorialCompletionCount: number
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoaded } = useUser()
    const [isOnboarding, setIsOnboarding] = useState(false)
    const [onboardingStep, setOnboardingStep] = useState<'add-item' | 'expand-item' | 'progress-bar' | 'checkup' | 'checkup-review' | 'checkup-submit' | 'email-signup' | 'completed'>('add-item')
    const [showSpotlight, setShowSpotlight] = useState(false)
    const [showExplanation, setShowExplanation] = useState<string | null>(null)
    const [tutorialCompletionCount, setTutorialCompletionCount] = useState(0)
    const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false)

    // Check if user needs onboarding when they first sign in
    useEffect(() => {
        if (isLoaded && user) {
            const completionCount = parseInt(localStorage.getItem(`tutorial-completion-count-${user.id}`) || '0')
            setTutorialCompletionCount(completionCount)
            setHasCompletedTutorial(completionCount > 0)

            // Only auto-start onboarding if they haven't completed it before
            if (completionCount === 0) {
                setIsOnboarding(true)
                setOnboardingStep('add-item')
            }
        }
    }, [isLoaded, user])

    const startOnboarding = () => {
        setIsOnboarding(true)
        setOnboardingStep('add-item')
        setShowSpotlight(true)
    }

    const skipOnboarding = () => {
        if (user) {
            const newCount = tutorialCompletionCount + 1
            localStorage.setItem(`tutorial-completion-count-${user.id}`, newCount.toString())
            setTutorialCompletionCount(newCount)
            setHasCompletedTutorial(true)
        }
        setIsOnboarding(false)
        setShowSpotlight(false)
    }

    const nextStep = () => {
        if (onboardingStep === 'add-item') {
            setOnboardingStep('expand-item')
            setShowSpotlight(true)
        } else if (onboardingStep === 'expand-item') {
            setOnboardingStep('progress-bar')
            setShowSpotlight(true)
        } else if (onboardingStep === 'progress-bar') {
            setOnboardingStep('checkup')
            setShowSpotlight(true)
        } else if (onboardingStep === 'checkup') {
            setOnboardingStep('checkup-review')
            setShowSpotlight(true)
        } else if (onboardingStep === 'checkup-review') {
            setOnboardingStep('checkup-submit')
            setShowSpotlight(true)
        } else if (onboardingStep === 'checkup-submit') {
            setOnboardingStep('email-signup')
            setShowSpotlight(true)
        } else if (onboardingStep === 'email-signup') {
            completeOnboarding()
        }
    }

    const completeOnboarding = () => {
        if (user) {
            const newCount = tutorialCompletionCount + 1
            localStorage.setItem(`tutorial-completion-count-${user.id}`, newCount.toString())
            setTutorialCompletionCount(newCount)
            setHasCompletedTutorial(true)
        }
        setIsOnboarding(false)
        setOnboardingStep('completed')
        setShowSpotlight(false)
    }

    return (
        <OnboardingContext.Provider value={{
            isOnboarding,
            onboardingStep,
            startOnboarding,
            skipOnboarding,
            nextStep,
            completeOnboarding,
            showSpotlight,
            setShowSpotlight,
            showExplanation,
            setShowExplanation,
            hasCompletedTutorial,
            tutorialCompletionCount
        }}>
            {children}
        </OnboardingContext.Provider>
    )
}

export function useOnboarding() {
    const context = useContext(OnboardingContext)
    if (context === undefined) {
        throw new Error('useOnboarding must be used within an OnboardingProvider')
    }
    return context
}
