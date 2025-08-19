import 'server-only'

import { NextResponse } from "next/server";

export async function GET() {
    // This endpoint is deprecated - all authentication now uses JWT
    // Returning an error to help debug any lingering calls to this endpoint
    console.warn('DEPRECATED: /api/csrf-token endpoint called - use JWT authentication instead')
    
    return NextResponse.json(
        { 
            error: "CSRF token endpoint deprecated", 
            message: "This app now uses JWT authentication. Use /django-api/clerk_jwt instead." 
        }, 
        { status: 410 } // 410 Gone - indicates this endpoint is permanently removed
    );
}
