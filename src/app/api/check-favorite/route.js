import { NextResponse } from 'next/server';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'Missing required parameter: fid' },
        { status: 400 }
      );
    }

    // Get the most recent favorite for this user
    const query = `
      SELECT id, favorite_llm, token_id, image_url, tx, created_at
      FROM user_favorite_llm
      WHERE fid = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [fid]);
    const favorite = result.rows[0];

    return NextResponse.json({
      hasFavorite: !!favorite,
      favorite: favorite || null
    });
  } catch (error) {
    console.error('Error checking favorite:', error);
    return NextResponse.json(
      { error: 'Failed to check favorite status', details: error.message },
      { status: 500 }
    );
  }
} 