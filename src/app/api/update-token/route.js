import { NextResponse } from 'next/server';
import pg from 'pg';

// Create a new pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

export async function POST(request) {
  try {
    const { rowId, tokenId } = await request.json();

    // Validate required fields
    if (!rowId || tokenId === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: rowId and tokenId' },
        { status: 400 }
      );
    }

    // Update the row with the token ID
    const query = `
      UPDATE user_favorite_llm
      SET token_id = $1
      WHERE id = $2
      RETURNING id
    `;

    const result = await pool.query(query, [tokenId, rowId]);

    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Row not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating token:', error);
    return NextResponse.json(
      { error: 'Failed to update token', details: error.message },
      { status: 500 }
    );
  }
} 