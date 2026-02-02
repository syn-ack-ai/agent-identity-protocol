import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const since = request.nextUrl.searchParams.get('since');

    // Validate since param is a valid ISO 8601 timestamp
    if (since) {
      const parsed = Date.parse(since);
      if (isNaN(parsed)) {
        return NextResponse.json(
          { error: 'Invalid "since" parameter. Must be a valid ISO 8601 timestamp.' },
          { status: 400 }
        );
      }
    }

    let rows;
    if (since) {
      rows = await sql`SELECT jti, revoked_at, expires_at FROM revoked_tokens WHERE revoked_at > ${since}::timestamptz ORDER BY revoked_at DESC`;
    } else {
      rows = await sql`SELECT jti, revoked_at, expires_at FROM revoked_tokens ORDER BY revoked_at DESC`;
    }

    const revoked = rows.map((r) => {
      const entry: Record<string, unknown> = {
        jti: r.jti,
        revoked_at: r.revoked_at,
      };
      if (r.expires_at) {
        entry.exp = Math.floor(new Date(r.expires_at as string).getTime() / 1000);
      }
      return entry;
    });

    const body = {
      revoked,
      count: revoked.length,
      updated_at: new Date().toISOString(),
    };

    const bodyStr = JSON.stringify(body);
    const etag = `"${createHash('md5').update(bodyStr).digest('hex')}"`;

    // Check If-None-Match
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'ETag': etag,
      },
    });
  } catch (err) {
    console.error('Revocations list error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch revocations' },
      { status: 500 }
    );
  }
}
