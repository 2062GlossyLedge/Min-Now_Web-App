/**
 * Unit tests for API utility functions
 * Tests cover authentication, CRUD operations, and file validation
 */

import {
    fetchItemsByStatus,
    createItem,
    updateItem,
    deleteItem,
    fetchUserItemStats,
    agentAddItem,
    validateImageFile,
    isHEIC,
    isBrowserSupportedImageFormat,
    isIOS,
    fetchDonatedBadges,
    createCheckup,
    completeCheckup,
} from '../api';

// Mock fetch globally
global.fetch = jest.fn();

// Helper to create mock getToken function
const mockGetToken = (token: string | null = 'mock-jwt-token') => {
    return jest.fn(async () => token);
};

// Helper to reset all mocks
beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
});

describe('fetchItemsByStatus', () => {
    // Test 1: Successfully fetch items by status
    it('should successfully fetch items by status', async () => {
        const mockItems = [
            {
                id: '1',
                name: 'Test Item',
                item_type: 'Technology',
                picture_url: 'https://example.com/image.jpg',
                status: 'Keep',
                ownership_duration: { description: '2 years' },
                ownership_duration_goal_months: 24,
                ownership_duration_goal_progress: 50,
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockItems,
        });

        const getToken = mockGetToken();
        const result = await fetchItemsByStatus('Keep', getToken);

        expect(result.data).toBeDefined();
        expect(result.data?.[0].name).toBe('Test Item');
        expect(result.data?.[0].itemType).toBe('Technology');
        expect(result.data?.[0].pictureUrl).toBe('https://example.com/image.jpg');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/django-api/items?status=Keep'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-jwt-token',
                }),
            })
        );
    });

    // Test 2: Handle error when fetching items fails
    it('should handle error when fetching items fails', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        });

        const getToken = mockGetToken();
        const result = await fetchItemsByStatus('Keep', getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('500');
        expect(result.data).toBeUndefined();
    });
});

describe('createItem', () => {
    // Test 1: Successfully create an item
    it('should successfully create an item', async () => {
        const mockCreatedItem = {
            id: '1',
            name: 'New Item',
            item_type: 'Clothing',
            picture_url: 'https://example.com/new.jpg',
            status: 'Keep',
            item_received_date: '2024-01-01',
            last_used: '2024-01-15',
            ownership_duration: { description: '1 month' },
        };

        // Mock CSRF token response
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            // Mock create item response
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockCreatedItem,
            });

        const getToken = mockGetToken();
        const itemData = {
            name: 'New Item',
            picture_url: 'https://example.com/new.jpg',
            item_type: 'Clothing',
            status: 'Keep',
            item_received_date: '2024-01-01',
            last_used: '2024-01-15',
        };

        const result = await createItem(itemData, getToken);

        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe('New Item');
        expect(result.data?.itemType).toBe('Clothing');
        expect(result.error).toBeUndefined();
    });

    // Test 2: Handle error when item creation fails
    it('should handle error when item creation fails', async () => {
        // Mock CSRF token response
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            // Mock failed create item response
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => 'Bad Request: Invalid item data',
            });

        const getToken = mockGetToken();
        const itemData = {
            name: '',
            picture_url: '',
            item_type: 'Invalid',
            status: 'Keep',
            item_received_date: '2024-01-01',
            last_used: '2024-01-15',
        };

        const result = await createItem(itemData, getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('400');
        expect(result.data).toBeUndefined();
    });
});

describe('updateItem', () => {
    // Test 1: Successfully update an item
    it('should successfully update an item', async () => {
        const mockUpdatedItem = {
            id: '1',
            name: 'Updated Item',
            item_type: 'Technology',
            status: 'Donated',
            picture_url: 'https://example.com/updated.jpg',
            ownership_duration: { description: '3 years' },
        };

        // Mock CSRF token and update responses
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockUpdatedItem,
            });

        const getToken = mockGetToken();
        const updates = {
            name: 'Updated Item',
            status: 'Donated',
        };

        const result = await updateItem('1', updates, getToken);

        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe('Updated Item');
        expect(result.data?.status).toBe('Donated');
        expect(result.error).toBeUndefined();
    });

    // Test 2: Handle error when update fails
    it('should handle error when update fails', async () => {
        // Mock CSRF token and failed update
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => 'Not Found',
            });

        const getToken = mockGetToken();
        const updates = { name: 'Updated Item' };

        const result = await updateItem('999', updates, getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('404');
        expect(result.data).toBeUndefined();
    });
});

describe('deleteItem', () => {
    // Test 1: Successfully delete an item without file
    it('should successfully delete an item without uploadthing file', async () => {
        const mockItem = {
            id: '1',
            name: 'Item to Delete',
            picture_url: null,
        };

        // Mock fetch for getting item, CSRF token, and delete
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockItem,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
            });

        const getToken = mockGetToken();
        const result = await deleteItem('1', getToken);

        expect(result.error).toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(3); // get item, csrf, delete
    });

    // Test 2: Successfully delete an item with uploadthing file
    it('should successfully delete an item with uploadthing file', async () => {
        const mockItem = {
            id: '1',
            name: 'Item with Image',
            picture_url: 'https://utfs.io/f/abc123xyz',
            pictureUrl: 'https://utfs.io/f/abc123xyz',
        };

        // Mock: get item, delete file from uploadthing, CSRF, delete item
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockItem,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
            });

        const getToken = mockGetToken();
        const result = await deleteItem('1', getToken);

        expect(result.error).toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(4);
        // Verify uploadthing delete was called
        expect(global.fetch).toHaveBeenCalledWith(
            '/api/uploadthing/delete',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ fileKey: 'abc123xyz' }),
            })
        );
    });
});

describe('fetchUserItemStats', () => {
    // Test 1: Successfully fetch user item stats
    it('should successfully fetch user item stats', async () => {
        const mockStats = {
            current_count: 5,
            max_items: 10,
            remaining_slots: 5,
            can_add_items: true,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockStats,
        });

        const getToken = mockGetToken();
        const result = await fetchUserItemStats(getToken);

        expect(result.data).toEqual(mockStats);
        expect(result.error).toBeUndefined();
    });

    // Test 2: Handle error when fetching stats fails
    it('should handle error when fetching stats fails', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized',
        });

        const getToken = mockGetToken();
        const result = await fetchUserItemStats(getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('401');
        expect(result.data).toBeUndefined();
    });
});

describe('agentAddItem', () => {
    // Test 1: Successfully add item using agent
    it('should successfully add item using agent', async () => {
        const mockResponse = {
            success: true,
            item: {
                id: '1',
                name: 'AI Generated Item',
                item_type: 'Technology',
            },
        };

        // Mock CSRF and agent response
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

        const getToken = mockGetToken();
        const prompt = 'Add my laptop';
        const result = await agentAddItem(prompt, getToken);

        expect(result.data).toEqual(mockResponse);
        expect(result.error).toBeUndefined();
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/django-api/agent-add-item'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ prompt }),
            })
        );
    });

    // Test 2: Handle error when agent fails
    it('should handle error when agent fails', async () => {
        // Mock CSRF and failed agent response
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Agent processing failed',
            });

        const getToken = mockGetToken();
        const prompt = 'Invalid prompt';
        const result = await agentAddItem(prompt, getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('500');
        expect(result.data).toBeUndefined();
    });
});

describe('fetchDonatedBadges', () => {
    // Test 1: Successfully fetch donated badges
    it('should successfully fetch donated badges', async () => {
        const mockBadges = [
            { id: 1, name: 'Early Adopter', earned_date: '2024-01-01' },
            { id: 2, name: 'Generous Giver', earned_date: '2024-02-01' },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockBadges,
        });

        const getToken = mockGetToken();
        const result = await fetchDonatedBadges(getToken);

        expect(result.data).toEqual(mockBadges);
        expect(result.error).toBeUndefined();
    });

    // Test 2: Handle error when fetching badges fails
    it('should handle error when fetching badges fails', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
        });

        const getToken = mockGetToken();
        const result = await fetchDonatedBadges(getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('403');
    });
});

describe('createCheckup', () => {
    // Test 1: Successfully create a checkup
    it('should successfully create a checkup', async () => {
        const mockCheckup = {
            id: 1,
            last_checkup_date: '2024-01-01',
            checkup_interval_months: 3,
            is_checkup_due: false,
        };

        // Mock CSRF and create checkup
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockCheckup,
            });

        const getToken = mockGetToken();
        const checkupData = {
            interval_months: 3,
            checkup_type: 'monthly',
        };

        const result = await createCheckup(checkupData, getToken);

        expect(result.data).toEqual(mockCheckup);
        expect(result.error).toBeUndefined();
    });

    // Test 2: Handle error when creating checkup fails
    it('should handle error when creating checkup fails', async () => {
        // Mock CSRF and failed creation
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => 'Invalid checkup data',
            });

        const getToken = mockGetToken();
        const checkupData = {
            interval_months: -1,
            checkup_type: 'invalid',
        };

        const result = await createCheckup(checkupData, getToken);

        expect(result.error).toBeDefined();
        expect(result.data).toBeUndefined();
    });
});

describe('completeCheckup', () => {
    // Test 1: Successfully complete a checkup
    it('should successfully complete a checkup', async () => {
        const mockCompletedCheckup = {
            id: 1,
            last_checkup_date: new Date().toISOString(),
            checkup_interval_months: 3,
            is_checkup_due: false,
        };

        // Mock CSRF and complete checkup
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockCompletedCheckup,
            });

        const getToken = mockGetToken();
        const result = await completeCheckup(1, getToken);

        expect(result.data).toEqual(mockCompletedCheckup);
        expect(result.error).toBeUndefined();
    });

    // Test 2: Handle error when completing checkup fails
    it('should handle error when completing checkup fails', async () => {
        // Mock CSRF and failed completion
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrf_token: 'mock-csrf-token' }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Checkup not found',
            });

        const getToken = mockGetToken();
        const result = await completeCheckup(999, getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('404');
    });
});

describe('File Validation Utils', () => {
    describe('isHEIC', () => {
        // Test 1: Detect HEIC by MIME type
        it('should detect HEIC files by MIME type', () => {
            const heicFile = new File([''], 'photo.heic', { type: 'image/heic' });
            expect(isHEIC(heicFile)).toBe(true);

            const heifFile = new File([''], 'photo.heif', { type: 'image/heif' });
            expect(isHEIC(heifFile)).toBe(true);
        });

        // Test 2: Detect HEIC by file extension
        it('should detect HEIC files by file extension', () => {
            const heicFile = new File([''], 'photo.HEIC', { type: '' });
            expect(isHEIC(heicFile)).toBe(true);

            const jpgFile = new File([''], 'photo.jpg', { type: 'image/jpeg' });
            expect(isHEIC(jpgFile)).toBe(false);
        });
    });

    describe('isBrowserSupportedImageFormat', () => {
        // Test 1: Recognize supported image formats
        it('should recognize supported image formats', () => {
            const jpegFile = new File([''], 'photo.jpg', { type: 'image/jpeg' });
            expect(isBrowserSupportedImageFormat(jpegFile)).toBe(true);

            const pngFile = new File([''], 'photo.png', { type: 'image/png' });
            expect(isBrowserSupportedImageFormat(pngFile)).toBe(true);

            const webpFile = new File([''], 'photo.webp', { type: 'image/webp' });
            expect(isBrowserSupportedImageFormat(webpFile)).toBe(true);
        });

        // Test 2: Reject unsupported image formats
        it('should reject unsupported image formats', () => {
            const heicFile = new File([''], 'photo.heic', { type: 'image/heic' });
            expect(isBrowserSupportedImageFormat(heicFile)).toBe(false);

            const tiffFile = new File([''], 'photo.tiff', { type: 'image/tiff' });
            expect(isBrowserSupportedImageFormat(tiffFile)).toBe(false);
        });
    });

    describe('validateImageFile', () => {
        // Test 1: Validate browser-supported formats
        it('should validate browser-supported image formats', () => {
            const jpegFile = new File([''], 'photo.jpg', { type: 'image/jpeg' });
            const result = validateImageFile(jpegFile);

            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        // Test 2: Reject HEIC on non-iOS devices
        it('should reject HEIC files on non-iOS devices', () => {
            // Mock non-iOS device
            Object.defineProperty(global.navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                writable: true,
            });

            const heicFile = new File([''], 'photo.heic', { type: 'image/heic' });
            const result = validateImageFile(heicFile);

            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('HEIC files are only supported on iOS');
        });
    });

    describe('isIOS', () => {
        // Test 1: Return false in Node environment (no window object)
        it('should return false in Node.js environment where window is undefined', () => {
            // In Node.js test environment, window is undefined
            // The function should return false which is the correct behavior
            expect(isIOS()).toBe(false);
        });

        // Note: Testing iOS detection in browser requires jsdom or browser environment
        // The function checks typeof window === 'undefined' first
        // In actual browser, it would check navigator.userAgent for iOS devices
    });
});

describe('Authentication', () => {
    // Test 1: Handle missing token
    it('should handle error when no token is available', async () => {
        // Mock console.error to suppress expected error output in tests
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const getToken = mockGetToken(null);
        const result = await fetchItemsByStatus('Keep', getToken);

        expect(result.error).toBeDefined();
        expect(result.error).toBe('Failed to fetch items');

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    // Test 2: Include JWT token in Authorization header
    it('should include JWT token in Authorization header', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        });

        const getToken = mockGetToken('test-jwt-token-123');
        await fetchItemsByStatus('Keep', getToken);

        expect(global.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-jwt-token-123',
                }),
            })
        );
    });
});
