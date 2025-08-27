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
            }
        }

        // Try to find the element immediately
        findTarget()

        // If not found, try again after a short delay
        const timeout = setTimeout(findTarget, 100)

        // Update position on scroll/resize
        const updatePosition = () => {
            if (targetElement) {
                setTargetRect(targetElement.getBoundingClientRect())
            }
        }

        window.addEventListener('scroll', updatePosition)
        window.addEventListener('resize', updatePosition)

        return () => {
            clearTimeout(timeout)
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

    const tooltipLeft = targetRect.left + targetRect.width + 20
    const tooltipTop = targetRect.top
    const tooltipWidth = 300

    // Adjust position if tooltip would go off screen
    const adjustedLeft = tooltipLeft + tooltipWidth > window.innerWidth 
        ? targetRect.left - tooltipWidth - 20 
        : tooltipLeft

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
                    className="absolute bg-white dark:bg-gray-800 rounded-lg p-4 shadow-xl max-w-sm z-1001"
                    style={{
                        left: adjustedLeft,
                        top: tooltipTop,
                        zIndex: 1001
                    }}
                >
                    <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
                        {title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
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
