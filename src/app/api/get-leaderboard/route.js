import { NextResponse } from 'next/server';
import pg from 'pg';

// Create a PostgreSQL connection pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT COUNT(0) as users_count, favorite_llm FROM user_favorite_llm GROUP BY favorite_llm ORDER BY users_count DESC'
    );

    return NextResponse.json({
      leaderboard: result.rows,
      total_votes: result.rows.reduce((acc, row) => acc + Number(row.users_count), 0),
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
} 