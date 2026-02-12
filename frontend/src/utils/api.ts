import { Item } from '@/types/item'
import { METHODS } from 'http';

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

// Helper function to delete files from uploadthing via API route
const deleteUploadthingFile = async (fileKey: string): Promise<boolean> => {
    try {
        // Call the API route to delete the file on server component
        const response = await fetch('/api/uploadthing/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileKey }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error('Failed to delete file from uploadthing:', errorData.error)
            return false
        }

        //console.log('Successfully deleted file from uploadthing:', fileKey)
        return true
    } catch (error) {
        console.error('Error calling uploadthing delete API:', error)
        return false
    }
}

// Helper function to handle async events with toasts for agentAddItemsBatch
import { toast } from 'sonner'

type AgentAddItemsBatchHandlers = {
    onSubmitting?: () => void
    onSuccess?: (data: any) => void
    onError?: (error: string) => void
}

// Helper function to get JWT token with validation
const getJWT = async (getToken: () => Promise<string | null>): Promise<string> => {
    const token = await getToken()
    if (!token) {
        throw new Error('No authentication token available')
    }
    return token
}

// Utility function to make authenticated fetch requests with JWT token and appropriate headers 
const fetchWithJWT = async (url: string, token: string, options: RequestInit = {}) => {
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

// Verify credentials by calling a protected endpoint that returns CSRF token
const testClerkAuth = async (getToken: () => Promise<string | null>): Promise<ApiResponse<any>> => {
    try {
        const token = await getJWT(getToken)

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
        console.error('Error authenticating:', error)
        return { error: 'Failed to authenticate' }
    }
}

// Enhanced fetch function that includes CSRF token for POST/PUT/DELETE requests
const fetchWithJWTAndCSRF = async (url: string, token: string, csrfToken?: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    }

    // Add CSRF token for mutating operations
    if (csrfToken && ['POST', 'PUT', 'DELETE', 'GET'].includes(options.method || 'GET')) {
        headers['X-CSRFToken'] = csrfToken
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for CSRF
    })

    return response
}

// Helper function to get CSRF token from auth endpoint
const getCSRFToken = async (getToken: () => Promise<string | null>): Promise<string | null> => {
    try {
        const result = await testClerkAuth(getToken)
        if (result.data && result.data.csrf_token) {
            return result.data.csrf_token
        }
        return null
    } catch (error) {
        console.error('Error getting CSRF token:', error)
        return null
    }
}

// Fetch items by status
export const fetchItemsByStatus = async (
    status: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item[]>> => {
    try {
        const token = await getJWT(getToken)

        const csrfToken = await getCSRFToken(getToken)

        const params = new URLSearchParams({ status })
        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/items?${params}`,
            token,
            csrfToken || undefined,
            {
                method: 'GET',
            }
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
        console.error('Error fetching items:', error)
        return { error: 'Failed to fetch items' }
    }
}

// Create item
export const createItem = async (
    itemData: ItemCreate,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFToken(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/items`,
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
        console.error('Error creating item:', error)
        return { error: 'Failed to create item' }
    }
}

// Get user item stats (count, limit, remaining slots)
export const fetchUserItemStats = async (
    getToken: () => Promise<string | null>
): Promise<ApiResponse<{
    current_count: number;
    max_items: number;
    remaining_slots: number;
    can_add_items: boolean;
}>> => {
    try {
        const token = await getJWT(getToken)

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/api/items/stats`,
            token,
            {
                method: 'GET',
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `HTTP ${response.status}: ${errorText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching user item stats:', error)
        return { error: 'Failed to fetch user item stats' }
    }
}

// Get item by ID
export const fetchItemById = async (
    id: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item>> => {
    try {
        const token = await getJWT(getToken)

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/api/items/${id}`,
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
        console.error('Error fetching item:', error)
        return { error: 'Failed to fetch item' }
    }
}

// Update item
export const updateItem = async (
    id: string,
    updates: {
        name?: string,
        lastUsedDate?: Date,
        status?: string,
        itemType?: string,
        receivedDate?: Date,
        ownershipDurationGoalMonths?: number,
        pictureUrl?: string
    },
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Item>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this PUT request
        const csrfToken = await getCSRFToken(getToken)

        const requestBody = {
            name: updates.name,
            item_received_date: updates.receivedDate?.toISOString(),
            last_used: updates.lastUsedDate?.toISOString(),
            status: updates.status,
            item_type: updates.itemType,
            ownership_duration_goal_months: updates.ownershipDurationGoalMonths,
            picture_url: updates.pictureUrl,
        }

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/items/${id}`,
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
        console.error('Error updating item:', error)
        return { error: 'Failed to update item' }
    }
}

// Delete item
export const deleteItem = async (
    id: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<void>> => {
    try {
        const token = await getJWT(getToken)

        // First, get the item to retrieve the picture_url for file deletion
        const itemResult = await fetchItemById(id, getToken)
        let fileKey: string | null = null

        if (itemResult.data?.pictureUrl) {
            // Extract file key from uploadthing URL
            // UploadThing URLs typically look like: https://utfs.io/f/[FILE_KEY]
            const urlMatch = itemResult.data.pictureUrl.match(/\/f\/([^/?]+)/)
            if (urlMatch) {
                fileKey = urlMatch[1]
            }
        }

        // Delete the file from uploadthing if a file key exists
        if (fileKey) {
            const deleteSuccess = await deleteUploadthingFile(fileKey)
            if (!deleteSuccess) {
                console.warn('Failed to delete file from uploadthing, continuing with item deletion')
                // Continue with item deletion even if file deletion fails
            }
        }

        // Get CSRF token for this DELETE request
        const csrfToken = await getCSRFToken(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/items/${id}`,
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
        console.error('Error deleting item:', error)
        return { error: 'Failed to delete item' }
    }
}

// Get donated badges
export const fetchDonatedBadges = async (
    getToken: () => Promise<string | null>
): Promise<ApiResponse<any>> => {
    try {
        const token = await getJWT(getToken)

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/api/badges/donated`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching donated badges:', error)
        return { error: 'Failed to fetch donated badges' }
    }
}

// Create checkup
export const createCheckup = async (
    checkupData: CheckupCreate,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFToken(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/checkups`,
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
        console.error('Error creating checkup:', error)
        return { error: 'Failed to create checkup' }
    }
}

// Fetch checkup by type
export const fetchCheckup = async (
    type: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup[]>> => {
    try {
        const token = await getJWT(getToken)

        const params = new URLSearchParams({ type: type.toLowerCase() })
        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/api/checkups?${params}`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching checkup:', error)
        return { error: 'Failed to fetch checkup' }
    }
}

// Get specific checkup by ID
export const getCheckupById = async (
    checkupId: number,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getJWT(getToken)

        const response = await fetchWithJWT(
            `${process.env.NEXT_PUBLIC_API_URL}/api/checkups/${checkupId}`,
            token
        )

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        console.error('Error fetching checkup by ID:', error)
        return { error: 'Failed to fetch checkup' }
    }
}

// Update checkup interval
export const updateCheckupInterval = async (
    checkupId: number,
    intervalMonths: number,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this PUT request
        const csrfToken = await getCSRFToken(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/checkups/${checkupId}/interval`,
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
        console.error('Error updating checkup interval:', error)
        return { error: 'Failed to update checkup interval' }
    }
}

// Complete checkup
export const completeCheckup = async (
    checkupId: number,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<Checkup>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFToken(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/checkups/${checkupId}/complete`,
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
        console.error('Error completing checkup:', error)
        return { error: 'Failed to complete checkup' }
    }
}

// Send test checkup email
export const sendTestCheckupEmail = async (
    getToken: () => Promise<string | null>
): Promise<ApiResponse<EmailResponse[]>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFToken(getToken)

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/send-test-email`,
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
        console.error('Error sending test checkup email:', error)
        return { error: 'Failed to send test checkup email' }
    }
}

// Add item using agent
export const agentAddItem = async (
    prompt: string,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<any>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFToken(getToken)

        //console.log('prompt to be sent:', prompt)
        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/agent-add-item`,
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
        console.error('Error adding item with agent:', error)
        return { error: 'Failed to add item with agent' }
    }
}

// Add items in batch using agent
export const agentAddItemsBatch = async (
    prompts: Record<string, string>,
    getToken: () => Promise<string | null>
): Promise<ApiResponse<any>> => {
    try {
        const token = await getJWT(getToken)

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFToken(getToken)

        //console.log('prompts to be sent:', prompts)
        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/agent-add-item-batch`,
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
        console.error('Error adding items batch with agent:', error)
        return { error: 'Failed to add items batch with agent' }
    }
}

// Batch add items with event handlers
export const agentAddItemsBatchWithHandlers = async (
    prompts: Record<string, string>,
    getToken: () => Promise<string | null>,
    handlers: AgentAddItemsBatchHandlers = {}
) => {
    handlers.onSubmitting?.()
    toast.loading('Processing batch add...', { id: 'batch-add-processing' })
    try {
        const result = await agentAddItemsBatch(prompts, getToken)
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

// Create handleEdit function for item updates
export const createHandleEdit = (
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
            const { data: updatedItem, error } = await updateItem(id, updates, getToken)
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
=== API AUTHENTICATION ===
All API functions use Clerk JWT tokens for authentication.
JWT tokens are obtained via getToken() from Clerk and passed to API functions.
*/

// File validation utilities for upload components
export const isIOS = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isBrowserSupportedImageFormat = (file: File): boolean => {
    const supportedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ];
    return supportedTypes.includes(file.type);
};

export const isHEIC = (file: File): boolean => {
    // Check MIME type first
    if (file.type === 'image/heic' || file.type === 'image/heif') {
        return true;
    }

    // Check file extension as fallback (some browsers don't set MIME type for HEIC)
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.heic') || fileName.endsWith('.heif');
}; export const validateImageFile = (file: File): { isValid: boolean; errorMessage?: string } => {
    // Always allow browser-supported formats
    if (isBrowserSupportedImageFormat(file)) {
        return { isValid: true };
    }

    // Allow HEIC only on iOS devices
    if (isHEIC(file)) {
        if (isIOS()) {
            return { isValid: true };
        } else {
            return {
                isValid: false,
                errorMessage: 'HEIC files are only supported on iOS devices. Please convert to JPEG or use another supported format (PNG, GIF, WebP, SVG) for other devices.'
            };
        }
    }

    // Reject other unsupported formats
    return {
        isValid: false,
        errorMessage: `File format "${file.type || 'unknown'}" is not supported. Please use JPEG, PNG, GIF, WebP, or SVG formats.`
    };
};

// Sync user preferences to Django backend
export const syncUserPreferences = async (
    preferences: {
        checkupInterval: number;
        emailNotifications: boolean;
    },
    getToken: () => Promise<string | null>
): Promise<ApiResponse<{
    message: string;
    email_notifications: boolean;
    checkup_interval: number;
    updated_checkups: Checkup[];
}>> => {
    try {
        const token = await getToken();

        if (!token) {
            throw new Error('No authentication token available');
        }

        // Get CSRF token for this POST request
        const csrfToken = await getCSRFToken(getToken);

        const response = await fetchWithJWTAndCSRF(
            `${process.env.NEXT_PUBLIC_API_URL}/api/sync-preferences`,
            token,
            csrfToken || undefined,
            {
                method: 'POST',
                body: JSON.stringify(preferences),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return { data };

    } catch (error) {
        console.error('Failed to sync user preferences:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to sync user preferences'
        };
    }
};