import 'server-only'

import { NextResponse } from "next/server";

export async function GET() {
    // This endpoint is called by legacy code that still tries to fetch CSRF tokens
    // Return a fake token to prevent 404 errors while the app transitions to JWT-only auth
    console.warn('LEGACY: /api/csrf-token endpoint called - this should not happen in production')
    
    return NextResponse.json(
        { 
            token: "legacy-stub-token",
            message: "This is a legacy endpoint. JWT authentication is now used." 
        }, 
        { status: 200 }
    );
}
