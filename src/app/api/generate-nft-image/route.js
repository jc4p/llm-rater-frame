import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/s3-client';
import pg from 'pg';

// Create a new pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

export async function POST(request) {
  try {
    const { pfpUrl, fid, rowId, llmType, tokenId } = await request.json();
    
    // Validate required parameters
    if (!pfpUrl || !fid || !rowId) {
      return NextResponse.json(
        { error: 'Missing required parameters: pfpUrl, fid, and rowId' },
        { status: 400 }
      );
    }
    
    // Validate LLM type (defaulting to claude if not provided)
    const validLlmTypes = ['claude', 'gemini', 'gpt'];
    const template = validLlmTypes.includes(llmType) ? llmType : 'claude';
    
    // Generate OG image URL
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : process.env.NEXT_PUBLIC_APP_URL;
      
    const ogImageUrl = `${baseUrl}/api/og?pfpUrl=${encodeURIComponent(pfpUrl)}&template=${template}&mode=nft`;
    
    // Fetch the generated image
    const imageResponse = await fetch(ogImageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to generate image: ${imageResponse.status}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Create a unique, meaningful filename
    // Use rowId as part of the filename to ensure we can find it later even without a token ID
    const filename = `favorite-llm/nft-${fid}-${template}-${rowId}-${tokenId || Date.now()}.png`;
    console.log('[API_DEBUG] Uploading NFT image to R2:', { 
      filename, 
      size: imageBuffer.byteLength,
      fid,
      rowId,
      template,
      tokenId: tokenId || 'not provided'
    });
    
    // Upload to R2
    const publicUrl = await uploadToR2(filename, Buffer.from(imageBuffer), 'image/png');
    console.log('[API_DEBUG] NFT image uploaded successfully:', { publicUrl });
    
    // Update the database with the image URL
    const query = `
      UPDATE user_favorite_llm
      SET image_url = $1
      WHERE id = $2
      RETURNING id, image_url
    `;
    
    console.log('[API_DEBUG] Updating user_favorite_llm with image URL:', { rowId, publicUrl });
    const result = await pool.query(query, [publicUrl, rowId]);
    console.log('[API_DEBUG] Database update result:', result.rows);
    
    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Row not found' },
        { status: 404 }
      );
    }
    
    // Return the URL of the uploaded image
    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    console.error('Error generating NFT image:', error);
    return NextResponse.json(
      { error: 'Failed to generate NFT image', details: error.message },
      { status: 500 }
    );
  }
}
