interface Env {
  DB: D1Database;
}

interface EventContext {
  request: Request;
  env: Env;
}

export async function onRequestPost(context: EventContext) {
  try {
    const data = (await context.request.json()) as {
      googleId: string;
      email: string;
      name: string;
      avatarUrl?: string;
    };

    const { googleId, email, name, avatarUrl } = data;

    if (!googleId || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'D1 Database binding DB not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = googleId;

    // Upsert into users table
    await db
      .prepare(
        `
      INSERT INTO users (id, google_id, email, name, avatar_url, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(google_id) DO UPDATE SET
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = CURRENT_TIMESTAMP
    `
      )
      .bind(userId, googleId, email, name, avatarUrl || '')
      .run();

    // Ensure player_stats entry exists
    await db
      .prepare(
        `
      INSERT INTO player_stats (user_id)
      VALUES (?)
      ON CONFLICT(user_id) DO NOTHING
    `
      )
      .bind(userId)
      .run();

    // Fetch updated user & stats
    const userRow = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
    const statsRow = await db.prepare(`SELECT * FROM player_stats WHERE user_id = ?`).bind(userId).first();

    return new Response(JSON.stringify({ user: userRow, stats: statsRow }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
