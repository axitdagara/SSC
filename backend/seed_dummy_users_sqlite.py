import sqlite3
from datetime import UTC, datetime, timedelta

DB_PATH = "ssc.db"


def get_password_hash(cursor):
    cursor.execute("SELECT password FROM users WHERE email = ? LIMIT 1", ("virat@ssc.com",))
    row = cursor.fetchone()
    if row and row[0]:
        return row[0]

    cursor.execute("SELECT password FROM users LIMIT 1")
    row = cursor.fetchone()
    if row and row[0]:
        return row[0]

    # Fallback only if table has no users yet
    return "password123"


def user_exists(cursor, email):
    cursor.execute("SELECT 1 FROM users WHERE email = ? LIMIT 1", (email,))
    return cursor.fetchone() is not None


def insert_user(cursor, payload):
    cursor.execute(
        """
        INSERT INTO users (
            name, email, password, jersey_number, role, bio,
            runs, matches, wickets, centuries, half_centuries,
            average_runs, highest_score, is_premium,
            premium_expiry, premium_start_date,
            is_active, created_at, updated_at, last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["name"],
            payload["email"],
            payload["password"],
            payload["jersey_number"],
            payload["role"],
            payload["bio"],
            payload["runs"],
            payload["matches"],
            payload["wickets"],
            payload["centuries"],
            payload["half_centuries"],
            payload["average_runs"],
            payload["highest_score"],
            1 if payload["is_premium"] else 0,
            payload["premium_expiry"],
            payload["premium_start_date"],
            1,
            payload["created_at"],
            payload["updated_at"],
            None,
        ),
    )


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    now = datetime.now(UTC).replace(microsecond=0)
    now_text = now.isoformat(sep=" ")
    premium_expiry_text = (now + timedelta(days=30)).isoformat(sep=" ")
    shared_password_hash = get_password_hash(cur)

    inserted_premium = 0
    inserted_guest = 0

    # 20 premium dummy players (10 batsmen + 10 bowlers)
    for i in range(1, 21):
        is_batsman = i <= 10
        email = f"premium{i:02d}@ssc.com"
        if user_exists(cur, email):
            continue

        runs = 1200 + (i * 45) if is_batsman else 320 + (i * 15)
        matches = 30 + i
        wickets = 8 + (i % 6) if is_batsman else 55 + (i * 3)
        avg_runs = round(runs / matches, 2) if matches else 0.0

        insert_user(
            cur,
            {
                "name": f"Premium Player {i:02d}",
                "email": email,
                "password": shared_password_hash,
                "jersey_number": 100 + i,
                "role": "player",
                "bio": "Premium Batsman" if is_batsman else "Premium Bowler",
                "runs": runs,
                "matches": matches,
                "wickets": wickets,
                "centuries": 2 + (i % 4) if is_batsman else 0,
                "half_centuries": 6 + (i % 8) if is_batsman else 1 + (i % 3),
                "average_runs": avg_runs,
                "highest_score": 95 + (i * 4) if is_batsman else 42 + (i % 10),
                "is_premium": True,
                "premium_expiry": premium_expiry_text,
                "premium_start_date": now_text,
                "created_at": now_text,
                "updated_at": now_text,
            },
        )
        inserted_premium += 1

    # 10 regular guest players
    for i in range(1, 11):
        email = f"guest{i:02d}@ssc.com"
        if user_exists(cur, email):
            continue

        runs = 140 + (i * 25)
        matches = 8 + i
        avg_runs = round(runs / matches, 2)

        insert_user(
            cur,
            {
                "name": f"Guest Player {i:02d}",
                "email": email,
                "password": shared_password_hash,
                "jersey_number": 200 + i,
                "role": "player",
                "bio": "Guest Regular Player",
                "runs": runs,
                "matches": matches,
                "wickets": 1 + (i % 4),
                "centuries": 0,
                "half_centuries": 0,
                "average_runs": avg_runs,
                "highest_score": 28 + (i * 3),
                "is_premium": False,
                "premium_expiry": None,
                "premium_start_date": None,
                "created_at": now_text,
                "updated_at": now_text,
            },
        )
        inserted_guest += 1

    conn.commit()

    cur.execute("SELECT COUNT(*) FROM users WHERE email LIKE 'premium%@ssc.com' AND is_premium = 1")
    total_premium = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users WHERE email LIKE 'guest%@ssc.com' AND is_premium = 0")
    total_guest = cur.fetchone()[0]

    conn.close()

    print(f"Inserted premium users: {inserted_premium}")
    print(f"Inserted guest users: {inserted_guest}")
    print(f"Total premium dummy users in DB: {total_premium}")
    print(f"Total guest dummy users in DB: {total_guest}")


if __name__ == "__main__":
    main()
