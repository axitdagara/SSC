"""
Test data loader for SSC
Run this script to populate the database with sample data for testing
"""

import os
import sys
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models import User, PerformanceLog
from app.utils.auth import hash_password

def load_test_data():
    """Load sample data into the database"""
    
    # Initialize database
    init_db()
    db = SessionLocal()
    
    try:
        print("📊 Loading test data...")
        
        # Create sample players
        players = [
            {
                "name": "Virat Kohli",
                "email": "virat@ssc.com",
                "password": hash_password("password123"),
                "jersey_number": 18,
                "bio": "Indian cricket legend",
                "runs": 12000,
                "matches": 200,
                "wickets": 0,
                "centuries": 45,
                "half_centuries": 50,
                "highest_score": 183,
            },
            {
                "name": "Jasprit Bumrah",
                "email": "bumrah@ssc.com",
                "password": hash_password("password123"),
                "jersey_number": 93,
                "bio": "Fast bowler extraordinaire",
                "runs": 500,
                "matches": 120,
                "wickets": 150,
                "centuries": 0,
                "half_centuries": 0,
                "highest_score": 34,
            },
            {
                "name": "Rohit Sharma",
                "email": "rohit@ssc.com",
                "password": hash_password("password123"),
                "jersey_number": 45,
                "bio": "Opening batsman",
                "runs": 9000,
                "matches": 150,
                "wickets": 5,
                "centuries": 31,
                "half_centuries": 40,
                "highest_score": 264,
                "is_premium": True,
                "premium_start_date": datetime.utcnow(),
                "premium_expiry": datetime.utcnow() + timedelta(days=30),
            },
            {
                "name": "MS Dhoni",
                "email": "dhoni@ssc.com",
                "password": hash_password("password123"),
                "jersey_number": 7,
                "bio": "Captain cool",
                "runs": 10000,
                "matches": 180,
                "wickets": 0,
                "centuries": 10,
                "half_centuries": 90,
                "highest_score": 224,
            },
            {
                "name": "Admin User",
                "email": "admin@ssc.com",
                "password": hash_password("admin123"),
                "jersey_number": None,
                "bio": "System administrator",
                "role": "admin",
                "runs": 0,
                "matches": 0,
            }
        ]

        # Add 20 premium dummy players (mix of batsman and bowler)
        premium_now = datetime.utcnow()
        for i in range(1, 21):
            is_batsman = i <= 10
            players.append(
                {
                    "name": f"Premium Player {i:02d}",
                    "email": f"premium{i:02d}@ssc.com",
                    "password": hash_password("password123"),
                    "jersey_number": 100 + i,
                    "bio": "Premium Batsman" if is_batsman else "Premium Bowler",
                    "runs": 1200 + (i * 45) if is_batsman else 320 + (i * 15),
                    "matches": 30 + i,
                    "wickets": 8 + (i % 6) if is_batsman else 55 + (i * 3),
                    "centuries": 2 + (i % 4) if is_batsman else 0,
                    "half_centuries": 6 + (i % 8) if is_batsman else 1 + (i % 3),
                    "highest_score": 95 + (i * 4) if is_batsman else 42 + (i % 10),
                    "is_premium": True,
                    "premium_start_date": premium_now,
                    "premium_expiry": premium_now + timedelta(days=30),
                }
            )

        # Add 10 regular guest dummy players
        for i in range(1, 11):
            players.append(
                {
                    "name": f"Guest Player {i:02d}",
                    "email": f"guest{i:02d}@ssc.com",
                    "password": hash_password("password123"),
                    "jersey_number": 200 + i,
                    "bio": "Guest Regular Player",
                    "runs": 140 + (i * 25),
                    "matches": 8 + i,
                    "wickets": 1 + (i % 4),
                    "centuries": 0,
                    "half_centuries": 0,
                    "highest_score": 28 + (i * 3),
                    "is_premium": False,
                }
            )
        
        existing_emails = {
            row[0] for row in db.query(User.email).all()
        }
        inserted_count = 0

        for player_data in players:
            if player_data["email"] in existing_emails:
                continue
            player = User(**player_data)
            db.add(player)
            inserted_count += 1
        
        db.commit()
        print(f"✓ Added {inserted_count} users (skipped existing emails)")
        
        # Add sample performance logs
        players = db.query(User).filter(User.role == "player").all()
        
        for player in players[:3]:  # Add logs for first 3 players
            for i in range(5):
                perf_log = PerformanceLog(
                    user_id=player.id,
                    match_date=datetime.utcnow() - timedelta(days=i*7),
                    runs_scored=45 + (i * 10),
                    wickets_taken=i % 3,
                    match_type="league",
                    opponent=f"Team {chr(65 + i)}",
                    performance_rating=7.5 + (i * 0.3),
                    notes=f"Good match {i+1}"
                )
                db.add(perf_log)
        
        db.commit()
        print("✓ Created sample performance logs")
        
        print("\n✅ Test data loaded successfully!")
        print("\nTest Accounts:")
        print("  📱 Regular Player")
        print("    Email: virat@ssc.com")
        print("    Password: password123")
        print("\n  👑 Premium Player")
        print("    Email: rohit@ssc.com")
        print("    Password: password123")
        print("\n  🔐 Admin")
        print("    Email: admin@ssc.com")
        print("    Password: admin123")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error loading test data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    load_test_data()
