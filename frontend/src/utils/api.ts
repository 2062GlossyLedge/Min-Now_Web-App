import { Item } from '@/types/item'

interface ApiResponse<T> {
    data?: T
    error?: string
}
// Add these interfaces at the top with other interfaces
interface Checkup {
    id: number;
    last_checkup_date: string;
    checkup_interval_months: number;
    is_checkup_due: boolean;
}

interface CheckupCreate {
    interval_months: number;
    checkup_type: string;
}

interface ItemCreate {
    name: string;
    picture_url: string;
    item_type: string;
    status: string;
    item_received_date: string;
    last_used: string;
    ownership_duration_goal_months?: number;
}

interface EmailResponse {
    checkup_type: string;
    recipient_email: string;
    recipient_username: string;
}

// utility csrf fetching for put, post, delete reqs
// to be called every request
export const fetchWithCsrf = async (url: string, options: RequestInit = {}) => {
    // First, ensure we have a CSRF token
    try {
        const csrfUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/csrf-token`;
        console.log('Fetching CSRF token from:', csrfUrl);
        //console.log('Current cookies:', document.cookie);

        const csrfResponse = await fetch(csrfUrl, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });

        console.log('CSRF Response Status:', csrfResponse.status);
        console.log('CSRF Response Headers:', {
            setCookie: csrfResponse.headers.get('set-cookie'),
            cookies: document.cookie,
            allHeaders: Object.fromEntries(csrfResponse.headers.entries())
        });

        if (!csrfResponse.ok) {
            throw new Error(`Failed to get CSRF token: ${csrfResponse.status} ${csrfResponse.statusText}`);
        }

        const csrf_token = await csrfResponse.json();
        console.log('CSRF Token Response Body:', csrf_token);

        const defaultOptions: RequestInit = {
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'X-CSRFToken': csrf_token.token,
            },
            credentials: 'include',
        }

        console.log('Making request to:', `${process.env.NEXT_PUBLIC_API_URL}${url}`)
        console.log('With headers:', defaultOptions.headers)

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Response not OK:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: errorText
            })
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
        }

        return response
    } catch (error) {
        console.error('Fetch error:', {
            error,
            url: `${process.env.NEXT_PUBLIC_API_URL}${url}`,
            options: {
                ...options,
                headers: options.headers,
            }
        })
        throw error
    }
}

export const createItem = async (itemData: ItemCreate, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Item>> => {
    try {
        const response = await fetchFn('/api/items', {
            method: 'POST',
            body: JSON.stringify(itemData),
        })
        const data = await response.json()

        // Map backend fields to frontend interface
        const mappedItem = {
            ...data,
            itemType: data.item_type,
            pictureUrl: data.picture_url,
            ownershipDuration: data.ownership_duration?.description || 'Not specified',
            ownershipDurationGoalMonths: data.ownership_duration_goal_months,
            ownershipDurationGoalProgress: data.ownership_duration_goal_progress
        }

        return { data: mappedItem }
    } catch (error) {
        console.error('Error creating item:', error)
        return { error: 'Failed to create item' }
    }
}


export const updateItem = async (id: string, updates: {
    name?: string,
    lastUsedDate?: Date,
    status?: string,
    itemType?: string,
    receivedDate?: Date,
    ownershipDurationGoalMonths?: number
}, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Item>> => {
    try {
        const requestBody = {
            name: updates.name,
            item_received_date: updates.receivedDate?.toISOString(),
            last_used: updates.lastUsedDate?.toISOString(),
            status: updates.status,
            item_type: updates.itemType,
            ownership_duration_goal_months: updates.ownershipDurationGoalMonths,
        }

        const response = await fetchFn(`/api/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(requestBody),
        })
        const data = await response.json()

        // Map backend fields to frontend interface
        const mappedItem = {
            ...data,
            itemType: data.item_type,
            pictureUrl: data.picture_url,
            ownershipDuration: data.ownership_duration?.description || 'Not specified',
            ownershipDurationGoalMonths: data.ownership_duration_goal_months,
            ownershipDurationGoalProgress: data.ownership_duration_goal_progress
        }

        return { data: mappedItem }
    } catch (error) {
        console.error('Error updating item:', error)
        return { error: 'Failed to update item' }
    }
}

export const deleteItem = async (id: string, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<void>> => {
    // Show submitting toast
    toast.loading('Deleting item...', { id: 'delete-item' })
    try {
        await fetchFn(`/api/items/${id}`, {
            method: 'DELETE',
        })
        toast.dismiss('delete-item')
        toast.success('Item deleted!')
        return {}
    } catch (error) {
        toast.dismiss('delete-item')
        toast.error('Failed to delete item')
        console.error('Error deleting item:', error)
        return { error: 'Failed to delete item' }
    }
}

export const fetchItemsByStatus = async (status: string, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Item[]>> => {
    try {
        //console.log('Fetching items with status:', status)
        const response = await fetchFn(`/api/items?status=${status}`)
        const data = await response.json()
        console.log('Received items data:', data)

        // Map backend fields to frontend interface
        const itemsWithDuration = data.map((item: any) => ({
            ...item,
            itemType: item.item_type, // Map item_type to itemType
            pictureUrl: item.picture_url, // Map picture_url to pictureUrl
            ownershipDuration: item.ownership_duration?.description || 'Not specified',
            ownershipDurationGoalMonths: item.ownership_duration_goal_months,
            ownershipDurationGoalProgress: item.ownership_duration_goal_progress
        }))

        return { data: itemsWithDuration }
    } catch (error: any) {
        console.error('Error fetching items:', {
            error,
            message: error.message,
            stack: error.stack,
            response: error.response
        })
        return { error: error.message || 'Failed to fetch items' }
    }
}

export const fetchCheckup = async (type: string, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Checkup>> => {
    try {
        const response = await fetchFn(`/api/checkups?type=${type.toLowerCase()}`)
        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching checkup:', error)
        return { error: 'Failed to fetch checkup' }
    }
}

export const createCheckup = async (checkupData: CheckupCreate, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Checkup>> => {
    try {
        const response = await fetchFn('/api/checkups', {
            method: 'POST',
            body: JSON.stringify(checkupData),
        })
        const data = await response.json()

        return { data }
    } catch (error) {
        console.error('Error creating checkup:', error)
        return { error: 'Failed to create checkup' }
    }
}

export const completeCheckup = async (checkupId: number, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Checkup>> => {
    try {
        const response = await fetchFn(`/api/checkups/${checkupId}/complete`, {
            method: 'POST',
        })
        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error completing checkup:', error)
        return { error: 'Failed to complete checkup' }
    }
}

export const sendTestCheckupEmail = async (fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<EmailResponse[]>> => {
    try {
        const response = await fetchFn('/api/send-test-email', {
            method: 'POST',
        })
        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error sending test checkup email:', error)
        return { error: 'Failed to send test checkup email' }
    }
}

export const fetchItemById = async (id: string, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Item>> => {
    try {
        const response = await fetchFn(`/api/items/${id}`)
        const data = await response.json()
        //console.log('Received item data:', data)

        // Map backend fields to frontend interface
        const mappedItem = {
            ...data,
            itemType: data.item_type,
            pictureUrl: data.picture_url,
            ownershipDuration: data.ownership_duration?.description || 'Not specified'
        }

        return { data: mappedItem }
    } catch (error) {
        console.error('Error fetching item:', error)
        return { error: 'Failed to fetch item' }
    }
}

// Agent Add Item: POST user prompt to backend agent endpoint
export const agentAddItem = async (prompt: string, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<any>> => {
    try {
        console.log('prompt to be sent:', prompt)
        const response = await fetchFn('/api/dev/agent-add-item', {
            method: 'POST',
            body: JSON.stringify({ prompt }),
        })
        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error adding item with agent:', error)
        return { error: 'Failed to add item with agent' }
    }
}

// Shared handleEdit function to eliminate code duplication
export const createHandleEdit = (
    currentStatus: string,
    setItems: React.Dispatch<React.SetStateAction<Item[]>>,
    authenticatedFetch: typeof fetchWithCsrf
) => {
    return async (id: string, updates: {
        name?: string,
        lastUsedDate?: Date,
        itemType?: string,
        receivedDate?: Date,
        status?: string,
        ownershipDurationGoalMonths?: number
    }) => {
        toast.loading('Updating item...', { id: 'edit-item' })
        try {
            const { data: updatedItem, error } = await updateItem(id, updates, authenticatedFetch)
            toast.dismiss('edit-item')
            if (error) {
                toast.error('Failed to update item')
                console.error('Error updating item:', error)
                return
            }
            if (updatedItem) {
                toast.success('Item updated!')
                // If the status changed and it's no longer the current view's status, remove the item from the list
                if (updates.status && updates.status !== currentStatus) {
                    setItems(prevItems => prevItems.filter(item => item.id !== id))
                } else {
                    setItems(prevItems =>
                        prevItems.map(item =>
                            item.id === id ? { ...item, ...updatedItem } : item
                        )
                    )
                }
            }
        } catch (error) {
            toast.dismiss('edit-item')
            toast.error('Failed to update item')
            console.error('Error updating item:', error)
        }
    }
}

// Agent Add Items Batch: POST dict of prompts to backend agent endpoint
export const agentAddItemsBatch = async (prompts: Record<string, string>, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<any>> => {
    try {
        console.log('prompts to be sent:', prompts)
        const response = await fetchFn('/api/agent-add-item-batch', {
            method: 'POST',
            body: JSON.stringify({ prompts }),
        })
        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error adding items batch with agent:', error)
        return { error: 'Failed to add items batch with agent' }
    }
}

// Helper function to handle async events with toasts for agentAddItemsBatch
import { toast } from 'sonner'

type AgentAddItemsBatchHandlers = {
    onSubmitting?: () => void
    onSuccess?: (data: any) => void
    onError?: (error: string) => void
}

export const agentAddItemsBatchWithHandlers = async (
    prompts: Record<string, string>,
    fetchFn: typeof fetchWithCsrf,
    handlers: AgentAddItemsBatchHandlers = {}
) => {
    handlers.onSubmitting?.()
    toast.loading('Processing batch add...', { id: 'batch-add-processing' })
    try {
        const result = await agentAddItemsBatch(prompts, fetchFn)
        toast.dismiss('batch-add-processing')
        if (result.data) {
            toast.success('All items added successfully!')
            handlers.onSuccess?.(result.data)
        } else {
            toast.error(result.error || 'Failed to add items via Quick Add')
            handlers.onError?.(result.error || 'Failed to add items via Quick Add')
        }
        return result
    } catch (error: any) {
        toast.dismiss('batch-add-processing')
        toast.error('Failed to add items via Quick Add')
        handlers.onError?.('Failed to add items via Quick Add')
        return { error: 'Failed to add items via Quick Add' }
    }
}

// New JWT-based authentication functions (alternative approach)
// These functions use Clerk's getToken() directly without CSRF tokens
// 
// COMPARISON:
// Current approach: fetchItemsByStatus() -> uses authenticatedFetch -> includes CSRF tokens -> calls /api/items
// New approach: fetchItemsByStatusJWT() -> uses getToken() -> JWT only -> calls /django-api/items
//
// BENEFITS OF NEW APPROACH:
// 1. Simpler - no CSRF token management needed
// 2. More standard - uses JWT Authorization header
// 3. Lighter - fewer HTTP requests (no CSRF token fetch)
// 4. More secure - JWT tokens are stateless and self-contained

export const fetchWithJWT = async (url: string, token: string, options: RequestInit = {}) => {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
    }

    const response = await fetch(url, {
        ...options,
        headers,
    })

    return response
}

// Test endpoint to verify JWT authentication and get CSRF token
export const testClerkJWT = async (getToken: () => Promise<string | null>): Promise<ApiResponse<any>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/clerk_jwt`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error testing JWT:', error)
        return { error: 'Failed to test JWT authentication' }
    }
}

// Enhanced JWT fetch function that includes CSRF token for POST/PUT/DELETE requests
export const fetchWithJWTAndCSRF = async (url: string, token: string, csrfToken?: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    }

    // Add CSRF token for mutating operations
    if (csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method || 'GET')) {
        headers['X-CSRFToken'] = csrfToken
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for CSRF
    })

    return response
}

// Helper function to get CSRF token from JWT test endpoint
export const getCSRFTokenFromJWT = async (getToken: () => Promise<string | null>): Promise<string | null> => {
    try {
        const result = await testClerkJWT(getToken)
        if (result.data && result.data.csrf_token) {
            return result.data.csrf_token
        }
        return null
    } catch (error) {
        console.error('Error getting CSRF token:', error)
        return null
    }
}

// Fetch items using JWT authentication (alternative to fetchItemsByStatus)
export const fetchItemsByStatusJWT = async (
    status: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item[]>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        const params = new URLSearchParams({ status })
        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/items?${params}`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()

        // Map backend fields to frontend interface (same as fetchItemsByStatus)
        const itemsWithDuration = data.map((item: any) => ({
            ...item,
            itemType: item.item_type,
            pictureUrl: item.picture_url,
            ownershipDuration: item.ownership_duration?.description || 'Not specified',
            ownershipDurationGoalMonths: item.ownership_duration_goal_months,
            ownershipDurationGoalProgress: item.ownership_duration_goal_progress
        }))

        return { data: itemsWithDuration }
    } catch (error) {
        console.error('Error fetching items with JWT:', error)
        return { error: 'Failed to fetch items' }
    }
}

// Create item using JWT authentication (alternative to createItem)
export const createItemJWT = async (
    itemData: ItemCreate,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/items/create`,
            token,
            csrfToken || undefined,
            {
                method: 'POST',
                body: JSON.stringify(itemData),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `HTTP ${response.status}: ${errorText}` }
        }

        const data = await response.json()

        // Map backend fields to frontend interface
        const mappedItem = {
            ...data,
            itemType: data.item_type,
            pictureUrl: data.picture_url,
            ownershipDuration: data.ownership_duration?.description || 'Not specified',
            ownershipDurationGoalMonths: data.ownership_duration_goal_months,
            ownershipDurationGoalProgress: data.ownership_duration_goal_progress
        }

        return { data: mappedItem }
    } catch (error) {
        console.error('Error creating item with JWT:', error)
        return { error: 'Failed to create item' }
    }
}

// Get item by ID using JWT authentication (alternative to fetchItemById)
export const fetchItemByIdJWT = async (
    id: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/items/${id}`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()

        // Map backend fields to frontend interface
        const mappedItem = {
            ...data,
            itemType: data.item_type,
            pictureUrl: data.picture_url,
            ownershipDuration: data.ownership_duration?.description || 'Not specified',
            ownershipDurationGoalMonths: data.ownership_duration_goal_months,
            ownershipDurationGoalProgress: data.ownership_duration_goal_progress
        }

        return { data: mappedItem }
    } catch (error) {
        console.error('Error fetching item with JWT:', error)
        return { error: 'Failed to fetch item' }
    }
}

// Update item using JWT authentication (alternative to updateItem)
export const updateItemJWT = async (
    id: string,
    updates: {
        name?: string,
        lastUsedDate?: Date,
        status?: string,
        itemType?: string,
        receivedDate?: Date,
        ownershipDurationGoalMonths?: number
    },
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this PUT request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        const requestBody = {
            name: updates.name,
            item_received_date: updates.receivedDate?.toISOString(),
            last_used: updates.lastUsedDate?.toISOString(),
            status: updates.status,
            item_type: updates.itemType,
            ownership_duration_goal_months: updates.ownershipDurationGoalMonths,
        }

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/items/${id}/update`,
            token,
            csrfToken || undefined,
            {
                method: 'PUT',
                body: JSON.stringify(requestBody),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `HTTP ${response.status}: ${errorText}` }
        }

        const data = await response.json()

        // Map backend fields to frontend interface
        const mappedItem = {
            ...data,
            itemType: data.item_type,
            pictureUrl: data.picture_url,
            ownershipDuration: data.ownership_duration?.description || 'Not specified',
            ownershipDurationGoalMonths: data.ownership_duration_goal_months,
            ownershipDurationGoalProgress: data.ownership_duration_goal_progress
        }

        return { data: mappedItem }
    } catch (error) {
        console.error('Error updating item with JWT:', error)
        return { error: 'Failed to update item' }
    }
}

// Delete item using JWT authentication (alternative to deleteItem)
export const deleteItemJWT = async (
    id: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<void>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this DELETE request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/items/${id}/delete`,
            token,
            csrfToken || undefined,
            {
                method: 'DELETE',
            }
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        return {}
    } catch (error) {
        console.error('Error deleting item with JWT:', error)
        return { error: 'Failed to delete item' }
    }
}

// Get donated badges using JWT authentication (alternative to get_donated_badges)
export const fetchDonatedBadgesJWT = async (
    getToken: () => Promise<string | null>
): Promise<ApiResponse<any>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/badges/donated`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching donated badges with JWT:', error)
        return { error: 'Failed to fetch donated badges' }
    }
}

// Create checkup using JWT authentication (alternative to createCheckup)
export const createCheckupJWT = async (
    checkupData: CheckupCreate,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/checkups/create`,
            token,
            csrfToken || undefined,
            {
                method: 'POST',
                body: JSON.stringify(checkupData),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `HTTP ${response.status}: ${errorText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error creating checkup with JWT:', error)
        return { error: 'Failed to create checkup' }
    }
}

// Fetch checkup using JWT authentication (alternative to fetchCheckup)
export const fetchCheckupJWT = async (
    type: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup[]>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        const params = new URLSearchParams({ type: type.toLowerCase() })
        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/checkups?${params}`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching checkup with JWT:', error)
        return { error: 'Failed to fetch checkup' }
    }
}

// Get specific checkup by ID using JWT authentication
export const getCheckupByIdJWT = async (
    checkupId: number,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/checkups/${checkupId}`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching checkup by ID with JWT:', error)
        return { error: 'Failed to fetch checkup' }
    }
}

// Update checkup interval using JWT authentication
export const updateCheckupIntervalJWT = async (
    checkupId: number,
    intervalMonths: number,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this PUT request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/checkups/${checkupId}/interval`,
            token,
            csrfToken || undefined,
            {
                method: 'PUT',
                body: JSON.stringify({ interval_months: intervalMonths }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `HTTP ${response.status}: ${errorText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error updating checkup interval with JWT:', error)
        return { error: 'Failed to update checkup interval' }
    }
}

// Complete checkup using JWT authentication (alternative to completeCheckup)
export const completeCheckupJWT = async (
    checkupId: number,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/checkups/${checkupId}/complete`,
            token,
            csrfToken || undefined,
            {
                method: 'POST',
            }
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error completing checkup with JWT:', error)
        return { error: 'Failed to complete checkup' }
    }
}

// Send test checkup email using JWT authentication (alternative to sendTestCheckupEmail)
export const sendTestCheckupEmailJWT = async (
    getToken: () => Promise<string | null>
): Promise<ApiResponse<EmailResponse[]>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/send-test-email`,
            token,
            csrfToken || undefined,
            {
                method: 'POST',
            }
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error sending test checkup email with JWT:', error)
        return { error: 'Failed to send test checkup email' }
    }
}

// Agent add item using JWT authentication (alternative to agentAddItem)
export const agentAddItemJWT = async (
    prompt: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<any>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        console.log('prompt to be sent:', prompt)
        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/agent-add-item`,
            token,
            csrfToken || undefined,
            {
                method: 'POST',
                body: JSON.stringify({ prompt }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `HTTP ${response.status}: ${errorText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error adding item with agent (JWT):', error)
        return { error: 'Failed to add item with agent' }
    }
}

// Agent add items batch using JWT authentication (alternative to agentAddItemsBatch)
export const agentAddItemsBatchJWT = async (
    prompts: Record<string, string>,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<any>> => {
    try {
        const token = await getToken()
        if (!token) {
            return { error: 'No authentication token available' }
        }

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFTokenFromJWT(getToken)

        console.log('prompts to be sent:', prompts)
        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/django-api/agent-add-item-batch`,
            token,
            csrfToken || undefined,
            {
                method: 'POST',
                body: JSON.stringify({ prompts }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `HTTP ${response.status}: ${errorText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error adding items batch with agent (JWT):', error)
        return { error: 'Failed to add items batch with agent' }
    }
}

// Helper function for JWT-based batch add with handlers (alternative to agentAddItemsBatchWithHandlers)
export const agentAddItemsBatchJWTWithHandlers = async (
    prompts: Record<string, string>,
    getToken: () => Promise<string | null>,
    handlers: AgentAddItemsBatchHandlers = {}
) => {
    handlers.onSubmitting?.()
    toast.loading('Processing batch add...', { id: 'batch-add-processing' })
    try {
        const result = await agentAddItemsBatchJWT(prompts, getToken)
        toast.dismiss('batch-add-processing')
        if (result.data) {
            toast.success('All items added successfully!')
            handlers.onSuccess?.(result.data)
        } else {
            toast.error(result.error || 'Failed to add items via Quick Add')
            handlers.onError?.(result.error || 'Failed to add items via Quick Add')
        }
        return result
    } catch (error: any) {
        toast.dismiss('batch-add-processing')
        toast.error('Failed to add items via Quick Add')
        handlers.onError?.('Failed to add items via Quick Add')
        return { error: 'Failed to add items via Quick Add' }
    }
}

// Create JWT-based handleEdit function (alternative to createHandleEdit)
export const createHandleEditJWT = (
    currentStatus: string,
    setItems: React.Dispatch<React.SetStateAction<Item[]>>,
    getToken: () => Promise<string | null>
) => {
    return async (id: string, updates: {
        name?: string,
        lastUsedDate?: Date,
        itemType?: string,
        receivedDate?: Date,
        status?: string,
        ownershipDurationGoalMonths?: number
    }) => {
        toast.loading('Updating item...', { id: 'edit-item' })
        try {
            const { data: updatedItem, error } = await updateItemJWT(id, updates, getToken)
            toast.dismiss('edit-item')
            if (error) {
                toast.error('Failed to update item')
                console.error('Error updating item:', error)
                return
            }
            if (updatedItem) {
                toast.success('Item updated!')
                // If the status changed and it's no longer the current view's status, remove the item from the list
                if (updates.status && updates.status !== currentStatus) {
                    setItems(prevItems => prevItems.filter(item => item.id !== id))
                } else {
                    setItems(prevItems =>
                        prevItems.map(item =>
                            item.id === id ? { ...item, ...updatedItem } : item
                        )
                    )
                }
            }
        } catch (error) {
            toast.dismiss('edit-item')
            toast.error('Failed to update item')
            console.error('Error updating item:', error)
        }
    }
}

/* 
=== API AUTHENTICATION APPROACHES ===

This file provides two complete authentication approaches for communicating with the backend:

1. CSRF TOKEN APPROACH (Original):
   - Functions: fetchItemsByStatus, createItem, updateItem, deleteItem, etc.
   - Uses: fetchWithCsrf() → authenticatedFetch
   - Authentication: CSRF tokens + session cookies
   - Endpoints: /api/* (Django-Ninja endpoints)
   - Process: Fetch CSRF token first, then include in X-CSRFToken header
   - Benefits: Built-in CSRF protection, session-based

2. JWT APPROACH (Alternative):
   - Functions: fetchItemsByStatusJWT, createItemJWT, updateItemJWT, deleteItemJWT, etc.
   - Uses: fetchWithJWT() → getToken() from Clerk
   - Authentication: JWT Bearer tokens
   - Endpoints: /django-api/* (Django view endpoints)
   - Process: Get JWT from Clerk, include in Authorization header
   - Benefits: Stateless, simpler, more standard, fewer HTTP requests

WHEN TO USE WHICH:
- Use CSRF approach for existing components that already work with it
- Use JWT approach for new features or when you want cleaner authentication
- Both approaches provide identical functionality and data mapping
- JWT approach is generally recommended for new development

EXAMPLE USAGE:
// CSRF approach (existing)
const { data, error } = await fetchItemsByStatus('owned', authenticatedFetch)

// JWT approach (new)
const { data, error } = await fetchItemsByStatusJWT('owned', getToken)
*/

