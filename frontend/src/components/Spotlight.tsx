'use client'

import { useEffect, useState } from 'react'

interface SpotlightProps {
    targetSelector: string
    title: string
    description: string
    onNext?: () => void
    onSkip?: () => void
    showNext?: boolean
    showSkip?: boolean
    nextText?: string
    skipText?: string
}

export default function Spotlight({
    targetSelector,
    title,
    description,
    onNext,
    onSkip,
    showNext = true,
    showSkip = true,
    nextText = "Got it!",
    skipText = "Skip"
}: SpotlightProps) {
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

    useEffect(() => {
        let retryCount = 0
        const maxRetries = 10
        
        const findTarget = () => {
            const element = document.querySelector(targetSelector) as HTMLElement
            if (element) {
                setTargetElement(element)
                setTargetRect(element.getBoundingClientRect())

                // Ensure the target element is highly clickable and visible
                element.style.position = 'relative'
                element.style.zIndex = '1002' // Higher than overlay
                element.style.pointerEvents = 'auto'

                // Add a subtle highlight to indicate it's the target
                element.style.backgroundColor = 'rgba(20, 184, 166, 0.1)'
                element.style.borderRadius = '4px'
                element.style.transition = 'all 0.3s ease'
                return true
            }
            return false
        }

        const attemptFind = () => {
            if (findTarget()) {
                return // Found the element, stop retrying
            }
            
            retryCount++
            if (retryCount < maxRetries) {
                // Progressively longer delays for elements that take time to render
                const delay = retryCount <= 3 ? 100 : retryCount <= 6 ? 200 : 500
                setTimeout(attemptFind, delay)
            }
        }

        // Start the search process
        attemptFind()

        // Update position on scroll/resize
        const updatePosition = () => {
            if (targetElement) {
                setTargetRect(targetElement.getBoundingClientRect())
            }
        }

        window.addEventListener('scroll', updatePosition)
        window.addEventListener('resize', updatePosition)

        return () => {
            window.removeEventListener('scroll', updatePosition)
            window.removeEventListener('resize', updatePosition)

            // Clean up the target element
            if (targetElement) {
                targetElement.style.position = ''
                targetElement.style.zIndex = ''
                targetElement.style.pointerEvents = ''
                targetElement.style.backgroundColor = ''
                targetElement.style.borderRadius = ''
                targetElement.style.transition = ''
            }
        }
    }, [targetSelector, targetElement])

    if (!targetRect) {
        return null
    }

    const tooltipWidth = 300

    // Always position tooltip below the target element for consistent behavior
    let adjustedLeft = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2)
    let adjustedTop = targetRect.bottom + 20

    // Ensure tooltip doesn't go off the edges of the screen
    if (adjustedLeft < 20) {
        adjustedLeft = 20
    } else if (adjustedLeft + tooltipWidth > window.innerWidth - 20) {
        adjustedLeft = window.innerWidth - tooltipWidth - 20
    }

    // If tooltip would go below viewport, position it above the target instead
    if (adjustedTop + 200 > window.innerHeight) { // Estimate tooltip height as 200px
        adjustedTop = targetRect.top - 220 // Position above with some margin
        if (adjustedTop < 20) {
            adjustedTop = 20 // Fallback to top of screen if needed
        }
    }

    return (
        <>
            {/* Minimal overlay that preserves background visibility */}
            <div
                className="fixed inset-0 bg-transparent z-1000"
                style={{ zIndex: 1000 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Invisible spotlight area - no overlay, just defines the clickable zone */}
                <div
                    className="absolute"
                    style={{
                        left: targetRect.left - 4,
                        top: targetRect.top - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                        pointerEvents: 'none', // Allow clicks to pass through to the actual element
                    }}
                />

                {/* Tooltip */}
                <div
                    className="absolute bg-white dark:bg-gray-900 rounded-lg p-4 shadow-xl max-w-sm z-1001 border border-gray-200 dark:border-gray-600"
                    style={{
                        left: adjustedLeft,
                        top: adjustedTop,
                        zIndex: 1001
                    }}
                >
                    <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
                        {title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-200 mb-4">
                        {description}
                    </p>
                    <div className="flex space-x-2">
                        {showNext && (
                            <button
                                onClick={onNext}
                                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                            >
                                {nextText}
                            </button>
                        )}
                        {showSkip && (
                            <button
                                onClick={onSkip}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                {skipText}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Remove the pulsing animation CSS since we're not using it anymore */}
        </>
    )
}
