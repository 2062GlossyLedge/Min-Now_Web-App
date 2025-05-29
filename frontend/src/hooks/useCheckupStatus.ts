import { useState, useEffect } from 'react'
import { fetchCheckup } from '@/utils/api'
import { useAuthenticatedFetch } from './useAuthenticatedFetch'

export const useCheckupStatus = (type: 'keep' | 'give') => {
    const [isCheckupDue, setIsCheckupDue] = useState(false)
    const { authenticatedFetch } = useAuthenticatedFetch()

    useEffect(() => {
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
    }, [type, authenticatedFetch])

    return isCheckupDue
} 