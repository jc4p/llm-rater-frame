import { ImageResponse } from '@vercel/og';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get image parameters
    const pfpUrl = searchParams.get('pfpUrl');
    const template = searchParams.get('template') || 'claude'; // Default to Claude template
    const mode = searchParams.get('mode') || 'share'; // 'share' or 'nft'
    
    // Define image dimensions based on mode
    let width, height;
    
    if (mode === 'nft') {
      // NFT image is square
      width = 1080;
      height = 1080;
    } else {
      // Share image is 3:2 aspect ratio
      width = 1080;
      height = 720;
    }
    
    console.log(`[OG Image] Creating ${mode} image with dimensions ${width}x${height}`);
    
    // Validate required parameters
    if (!pfpUrl) {
      return NextResponse.json({ error: 'Missing required parameter: pfpUrl' }, { status: 400 });
    }
    
    // Download profile picture
    let pfpImage;
    try {
      const pfpResponse = await fetch(pfpUrl);
      if (!pfpResponse.ok) {
        throw new Error(`Failed to fetch profile image: ${pfpResponse.status}`);
      }
      const arrayBuffer = await pfpResponse.arrayBuffer();
      pfpImage = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    } catch (error) {
      console.error('Error fetching profile image:', error);
      return NextResponse.json({ error: 'Failed to fetch profile image' }, { status: 500 });
    }
    
    // Set positioning based on the mode (share or nft)
    let pfpSize, pfpPosition;
    
    // Get debug flag from query params
    const debug = searchParams.get('debug') === 'true';
    
    if (mode === 'nft') {
      // For the 1080x1080 NFT image
      const centerX = 435.5;
      const centerY = 507;
      pfpSize = 195;
      pfpPosition = {
        x: centerX - pfpSize / 2, // X center at 435.5px
        y: centerY - pfpSize / 2, // Y center at 507px
        centerX, // Store center coordinates for debugging
        centerY,
      };
    } else {
      // For the 1080x720 Share image
      // Profile picture center is at x=604px, y=335px
      const centerX = 604;
      const centerY = 335;
      pfpSize = 98;
      
      pfpPosition = {
        x: centerX - pfpSize / 2, // Calculate position based on center point
        y: centerY - pfpSize / 2,
        centerX, // Store center coordinates for debugging
        centerY,
      };
      
      console.log('[OG Image] Share image PFP position:', {
        centerX,
        centerY,
        topLeft: { x: pfpPosition.x, y: pfpPosition.y },
        size: pfpSize
      });
    }
    
    // Define base URL for template images
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : process.env.NEXT_PUBLIC_BASE_URL || 'https://llm-rater-frame.vercel.app';
      
    // Define image templates based on LLM and mode
    const templateBackgrounds = {
      share: {
        claude: `${baseUrl}/templates/share-claude-bg.png`,
        gemini: `${baseUrl}/templates/share-gemini-bg.png`,
        gpt: `${baseUrl}/templates/share-chatgpt-bg.png`,
      },
      nft: {
        claude: `${baseUrl}/templates/nft-claude-bg.png`,
        gemini: `${baseUrl}/templates/nft-gemini-bg.png`,
        gpt: `${baseUrl}/templates/nft-chatgpt-bg.png`,
      },
    };
    
    // Choose the appropriate background
    const bgImage = templateBackgrounds[mode][template] || templateBackgrounds.share.claude;
    
    // Generate the image with profile picture overlay
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Background image */}
          <img
            src={bgImage}
            alt="Background"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          
          {/* Profile picture overlay */}
          <img
            src={pfpImage}
            alt="Profile"
            style={{
              position: 'absolute',
              top: `${pfpPosition.y}px`,
              left: `${pfpPosition.x}px`,
              width: `${pfpSize}px`,
              height: `${pfpSize}px`,
              borderRadius: '50%', // Make it circular
              objectFit: 'cover',
            }}
          />
        </div>
      ),
      {
        width,
        height,
      }
    );
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}