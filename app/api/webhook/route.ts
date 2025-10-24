import { NextRequest, NextResponse } from 'next/server';

/**
 * Webhook handler for Farcaster MiniApp events
 * This endpoint receives notifications about app installations, launches, and other events
 * 
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/webhooks}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log the webhook event for debugging
    console.log('Webhook received:', {
      type: body.type,
      timestamp: new Date().toISOString(),
      data: body
    });

    // Handle different webhook event types
    switch (body.type) {
      case 'app.install':
        // Handle app installation
        console.log('App installed by user:', body.data?.fid);
        break;
      
      case 'app.uninstall':
        // Handle app uninstallation
        console.log('App uninstalled by user:', body.data?.fid);
        break;
      
      case 'app.launch':
        // Handle app launch
        console.log('App launched by user:', body.data?.fid);
        break;
      
      default:
        console.log('Unknown webhook event type:', body.type);
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ 
      success: true,
      received: true 
    }, { 
      status: 200 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    
    // Return 200 even on error to prevent retries
    // You can change this to 500 if you want the platform to retry
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { 
      status: 200 
    });
  }
}

/**
 * GET handler for webhook verification
 * Some platforms send GET requests to verify the webhook endpoint is active
 */
export async function GET(request: NextRequest) {
  // Extract challenge parameter if present (some platforms use this for verification)
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    // Return the challenge for verification
    return NextResponse.json({ challenge }, { status: 200 });
  }
  
  // Return a simple success response
  return NextResponse.json({ 
    status: 'ok',
    message: 'Webhook endpoint is active' 
  }, { 
    status: 200 
  });
}
