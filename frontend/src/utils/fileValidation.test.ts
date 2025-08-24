// Simple test file to verify HEIC validation logic
// Run this with: npx ts-node src/utils/fileValidation.test.ts

import { isHEIC, isBrowserSupportedImageFormat, validateImageFile } from './api';

// Mock window object for testing
global.window = {} as any;
global.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
} as any;

// Test HEIC detection
console.log('Testing HEIC detection...');

// Test with HEIC file extension
const heicFile = new File([''], 'test.heic', { type: '' });
console.log('HEIC file by extension:', isHEIC(heicFile)); // Should be true

// Test with HEIC MIME type
const heicFileWithMime = new File([''], 'test.jpg', { type: 'image/heic' });
console.log('HEIC file by MIME type:', isHEIC(heicFileWithMime)); // Should be true

// Test regular JPEG
const jpegFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
console.log('JPEG file:', isHEIC(jpegFile)); // Should be false

// Test browser support
console.log('\nTesting browser support...');
console.log('JPEG supported:', isBrowserSupportedImageFormat(jpegFile)); // Should be true
console.log('HEIC supported in browser:', isBrowserSupportedImageFormat(heicFile)); // Should be false

// Test validation on Windows (non-iOS)
console.log('\nTesting validation on Windows...');
const jpegValidation = validateImageFile(jpegFile);
console.log('JPEG validation:', jpegValidation);

const heicValidation = validateImageFile(heicFile);
console.log('HEIC validation on Windows:', heicValidation);

console.log('\nAll tests completed!');
