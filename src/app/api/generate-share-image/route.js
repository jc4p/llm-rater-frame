import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/s3-client';

export async function POST(request) {
  try {
    const { pfpUrl, fid, llmType } = await request.json();
    
    // Validate required parameters
    if (!pfpUrl || !fid) {
      return NextResponse.json(
        { error: 'Missing required parameters: pfpUrl and fid' },
        { status: 400 }
      );
    }
    
    // Validate LLM type (defaulting to claude if not provided)
    const validLlmTypes = ['claude', 'gemini', 'gpt'];
    const template = validLlmTypes.includes(llmType) ? llmType : 'claude';
    
    // Generate OG image URL (for local testing, use localhost)
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : process.env.NEXT_PUBLIC_APP_URL;
      
    const ogImageUrl = `${baseUrl}/api/og?pfpUrl=${encodeURIComponent(pfpUrl)}&template=${template}&mode=share`;
    
    // Fetch the generated image
    const imageResponse = await fetch(ogImageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to generate image: ${imageResponse.status}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Upload to R2
    const filename = `favorite-llm/share-${fid}-${template}-${Date.now()}.png`;
    console.log('[API_DEBUG] Uploading share image to R2:', { filename, size: imageBuffer.byteLength });
    
    const publicUrl = await uploadToR2(filename, Buffer.from(imageBuffer), 'image/png');
    console.log('[API_DEBUG] Share image uploaded successfully:', { publicUrl });
    
    // Return the URL of the uploaded image
    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    console.error('Error generating share image:', error);
    return NextResponse.json(
      { error: 'Failed to generate share image', details: error.message },
      { status: 500 }
    );
  }
}
