import { useState, useEffect } from 'react'
// import { fetchCheckup } from '@/utils/api' // CSRF approach - commented out
import { fetchCheckupJWT } from '@/utils/api' // JWT approach
// import { useAuthenticatedFetch } from './useAuthenticatedFetch' // CSRF approach - commented out
import { useAuth } from '@clerk/nextjs' // JWT approach - get token from Clerk
import { useCheckupContext } from '@/contexts/CheckupContext'

export const useCheckupStatus = (type: 'keep' | 'give') => {
    const [isCheckupDue, setIsCheckupDue] = useState(false)
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { getToken } = useAuth() // JWT approach - get token from Clerk
    // const { isSignedIn, isLoaded } = useUser() // Get user authentication status // CSRF approach - commented out
    const { isSignedIn, isLoaded } = useAuth() // JWT approach - get auth status from Clerk

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
                // const { data, error } = await fetchCheckup(type, authenticatedFetch) // CSRF approach - commented out
                const { data } = await fetchCheckupJWT(type, getToken) // JWT approach - using getToken from Clerk
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