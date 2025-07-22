import { useState, useEffect } from 'react'
import { fetchCheckup } from '@/utils/api'
import { useAuthenticatedFetch } from './useAuthenticatedFetch'
import { useUser } from '@clerk/nextjs'

export const useCheckupStatus = (type: 'keep' | 'give') => {
    const [isCheckupDue, setIsCheckupDue] = useState(false)
    const { authenticatedFetch } = useAuthenticatedFetch()
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status

    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            setIsCheckupDue(false)
            return
        }
        const checkCheckupStatus = async () => {
            try {
                const { data, error } = await fetchCheckup(type, authenticatedFetch)
                console.log(`Checkup status for ${type}:`, data)
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
    }, [type, authenticatedFetch, isLoaded, isSignedIn])

    return isCheckupDue
} 