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
}

interface EmailResponse {
    checkup_type: string;
    recipient_email: string;
    recipient_username: string;
}

// utility csrf fetching for put, post, delete reqs
export const fetchWithCsrf = async (url: string, options: RequestInit = {}) => {
    // First, ensure we have a CSRF token
    try {
        const csrfUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/csrf-token`;
        console.log('Fetching CSRF token from:', csrfUrl);
        //console.log('Current cookies:', document.cookie);

        const csrfResponse = await fetch(csrfUrl, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });

        // console.log('CSRF Response Status:', csrfResponse.status);
        // console.log('CSRF Response Headers:', {
        //     setCookie: csrfResponse.headers.get('set-cookie'),
        //     cookies: document.cookie,
        //     allHeaders: Object.fromEntries(csrfResponse.headers.entries())
        // });

        if (!csrfResponse.ok) {
            throw new Error(`Failed to get CSRF token: ${csrfResponse.status} ${csrfResponse.statusText}`);
        }

        const csrf_token = await csrfResponse.json();
        // console.log('CSRF Token Response Body:', csrf_token);

        const defaultOptions: RequestInit = {
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'X-CSRFToken': csrf_token.token,
            },
            credentials: 'include',
        }

        console.log('Making request to:', `${process.env.NEXT_PUBLIC_BACKEND_API_URL}${url}`)
        console.log('With headers:', defaultOptions.headers)

        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}${url}`, {
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
            url: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}${url}`,
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
        return { data }
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
    receivedDate?: Date
}, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Item>> => {
    try {
        const requestBody = {
            name: updates.name,
            item_received_date: updates.receivedDate?.toISOString(),
            last_used: updates.lastUsedDate?.toISOString(),
            status: updates.status,
            item_type: updates.itemType,
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
            ownershipDuration: data.ownership_duration?.description || 'Not specified'
        }

        return { data: mappedItem }
    } catch (error) {
        console.error('Error updating item:', error)
        return { error: 'Failed to update item' }
    }
}

export const deleteItem = async (id: string, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<void>> => {
    try {
        await fetchFn(`/api/items/${id}`, {
            method: 'DELETE',
        })
        return {}
    } catch (error) {
        console.error('Error deleting item:', error)
        return { error: 'Failed to delete item' }
    }
}

export const fetchItemsByStatus = async (status: string, fetchFn: typeof fetchWithCsrf): Promise<ApiResponse<Item[]>> => {
    try {
        //console.log('Fetching items with status:', status)
        const response = await fetchFn(`/api/items?status=${status}`)
        const data = await response.json()
        //console.log('Received items data:', data)

        // Map backend fields to frontend interface
        const itemsWithDuration = data.map((item: any) => ({
            ...item,
            itemType: item.item_type, // Map item_type to itemType
            pictureUrl: item.picture_url, // Map picture_url to pictureUrl
            ownershipDuration: item.ownership_duration?.description || 'Not specified'
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
        const response = await fetchFn('/api/agent-add-item', {
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
        status?: string
    }) => {
        try {
            const { data: updatedItem, error } = await updateItem(id, updates, authenticatedFetch)
            if (error) {
                console.error('Error updating item:', error)
                return
            }
            if (updatedItem) {
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
            console.error('Error updating item:', error)
        }
    }
}

