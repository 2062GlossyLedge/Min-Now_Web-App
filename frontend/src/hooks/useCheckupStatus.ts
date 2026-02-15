import { useState, useEffect } from 'react'
import { fetchCheckup } from '@/utils/api'
import { useAuth } from '@clerk/nextjs'
import { useCheckupContext } from '@/contexts/CheckupContext'

export const useCheckupStatus = (type: 'keep' | 'give') => {
    const [isCheckupDue, setIsCheckupDue] = useState(false)
    const { getToken } = useAuth()
    const { isSignedIn, isLoaded } = useAuth()

    // Get refresh trigger from checkup context (optional - fallback if not in provider)
    let refreshTrigger = 0
    try {
        const context = useCheckupContext()
        refreshTrigger = context.refreshTrigger
    } catch {
        // Context not available, use default behavior
    }

    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            setIsCheckupDue(false)
            return
        }
        const checkCheckupStatus = async () => {
            try {
                const { data } = await fetchCheckup(type, getToken)
                //console.log(`Checkup status for ${type}:`, data)
                if (data && Array.isArray(data) && data.length > 0) {
                    // Get the most recent checkup
                    const mostRecentCheckup = data[0]
                    setIsCheckupDue(mostRecentCheckup.is_checkup_due)
                }
            } catch (error) {
                console.error('Error checking checkup status:', error)
            }
        }
        checkCheckupStatus()
    }, [type, getToken, isLoaded, isSignedIn, refreshTrigger]) // Added refreshTrigger to dependency array

    return isCheckupDue
} 