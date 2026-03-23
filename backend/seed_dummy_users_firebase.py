#!/usr/bin/env python3
"""
Seed Firebase with dummy player users (10 premium + 5 non-premium)
Run from backend directory: python seed_dummy_users_firebase.py
"""

import firebase_admin
from firebase_admin import credentials, auth, firestore
from datetime import datetime, timedelta
import os

# Initialize Firebase
cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'firebase-service-account.json')
if not firebase_admin._apps:
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        raise FileNotFoundError(f"Service account file not found: {cred_path}")

db = firestore.client()
auth_client = auth

# Dummy user data
DUMMY_USERS = [
    # Premium players
    {
        "name": "Virat Kohli",
        "email": "virat.kohli@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 18,
        "runs": 7000,
        "matches": 150,
        "wickets": 0,
        "centuries": 50,
        "half_centuries": 35,
        "highest_score": 183,
        "average_runs": 46.67,
    },
    {
        "name": "Rohit Sharma",
        "email": "rohit.sharma@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 45,
        "runs": 6500,
        "matches": 145,
        "wickets": 0,
        "centuries": 48,
        "half_centuries": 38,
        "highest_score": 264,
        "average_runs": 44.83,
    },
    {
        "name": "Jasprit Bumrah",
        "email": "jasprit.bumrah@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 93,
        "runs": 500,
        "matches": 120,
        "wickets": 280,
        "centuries": 0,
        "half_centuries": 0,
        "highest_score": 34,
        "average_runs": 4.17,
    },
    {
        "name": "Hardik Pandya",
        "email": "hardik.pandya@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 31,
        "runs": 3500,
        "matches": 110,
        "wickets": 145,
        "centuries": 5,
        "half_centuries": 18,
        "highest_score": 123,
        "average_runs": 31.82,
    },
    {
        "name": "MS Dhoni",
        "email": "ms.dhoni@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 7,
        "runs": 5000,
        "matches": 130,
        "wickets": 0,
        "centuries": 12,
        "half_centuries": 28,
        "highest_score": 156,
        "average_runs": 38.46,
    },
    {
        "name": "Shikhar Dhawan",
        "email": "shikhar.dhawan@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 25,
        "runs": 6800,
        "matches": 160,
        "wickets": 0,
        "centuries": 52,
        "half_centuries": 40,
        "highest_score": 192,
        "average_runs": 42.50,
    },
    {
        "name": "KL Rahul",
        "email": "kl.rahul@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 1,
        "runs": 4200,
        "matches": 95,
        "wickets": 0,
        "centuries": 18,
        "half_centuries": 22,
        "highest_score": 180,
        "average_runs": 44.21,
    },
    {
        "name": "Ravichandran Ashwin",
        "email": "ravichandran.ashwin@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 37,
        "runs": 3200,
        "matches": 140,
        "wickets": 420,
        "centuries": 8,
        "half_centuries": 15,
        "highest_score": 113,
        "average_runs": 22.86,
    },
    {
        "name": "Yuzvendra Chahal",
        "email": "yuzvendra.chahal@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 72,
        "runs": 600,
        "matches": 95,
        "wickets": 310,
        "centuries": 0,
        "half_centuries": 0,
        "highest_score": 38,
        "average_runs": 6.32,
    },
    {
        "name": "Bhuvneshwar Kumar",
        "email": "bhuvneshwar.kumar@example.com",
        "password": "Password@123",
        "is_premium": True,
        "jersey_number": 33,
        "runs": 400,
        "matches": 110,
        "wickets": 290,
        "centuries": 0,
        "half_centuries": 0,
        "highest_score": 28,
        "average_runs": 3.64,
    },
    # Non-premium players
    {
        "name": "Prithvi Shaw",
        "email": "prithvi.shaw@example.com",
        "password": "Password@123",
        "is_premium": False,
        "jersey_number": 10,
        "runs": 1200,
        "matches": 35,
        "wickets": 0,
        "centuries": 3,
        "half_centuries": 8,
        "highest_score": 146,
        "average_runs": 34.29,
    },
    {
        "name": "Ruturaj Gaikwad",
        "email": "ruturaj.gaikwad@example.com",
        "password": "Password@123",
        "is_premium": False,
        "jersey_number": 5,
        "runs": 900,
        "matches": 28,
        "wickets": 0,
        "centuries": 2,
        "half_centuries": 5,
        "highest_score": 128,
        "average_runs": 32.14,
    },
    {
        "name": "Devdutt Padikkal",
        "email": "devdutt.padikkal@example.com",
        "password": "Password@123",
        "is_premium": False,
        "jersey_number": 4,
        "runs": 800,
        "matches": 32,
        "wickets": 0,
        "centuries": 1,
        "half_centuries": 6,
        "highest_score": 102,
        "average_runs": 25.00,
    },
    {
        "name": "Ishan Kishan",
        "email": "ishan.kishan@example.com",
        "password": "Password@123",
        "is_premium": False,
        "jersey_number": 23,
        "runs": 1100,
        "matches": 40,
        "wickets": 0,
        "centuries": 2,
        "half_centuries": 7,
        "highest_score": 131,
        "average_runs": 27.50,
    },
    {
        "name": "Shreyas Iyer",
        "email": "shreyas.iyer@example.com",
        "password": "Password@123",
        "is_premium": False,
        "jersey_number": 27,
        "runs": 1500,
        "matches": 50,
        "wickets": 0,
        "centuries": 4,
        "half_centuries": 10,
        "highest_score": 144,
        "average_runs": 30.00,
    },
]


def create_firebase_users():
    """Create users in Firebase Authentication and Firestore"""
    created_count = 0
    failed_count = 0
    
    print(f"\n[FIREBASE] Creating {len(DUMMY_USERS)} dummy users in Firebase...\n")
    
    for user_data in DUMMY_USERS:
        try:
            email = user_data["email"]
            password = user_data["password"]
            name = user_data["name"]
            is_premium = user_data["is_premium"]
            
            # Create user in Firebase Authentication
            user_record = auth_client.create_user(
                email=email,
                password=password,
                display_name=name,
            )
            
            uid = user_record.uid
            print(f"[OK] Created Firebase Auth user: {name} ({email}) - UID: {uid[:12]}...")
            
            # Prepare user document for Firestore
            now = datetime.utcnow()
            premium_expiry = None
            if is_premium:
                # Premium expires 30 days from now
                premium_expiry = now + timedelta(days=30)
            
            firestore_user = {
                "id": uid,  # Store Firebase UID as id
                "uid": uid,  # Also store as uid
                "email": email,
                "name": name,
                "role": "player",
                "is_active": True,
                "is_premium": is_premium,
                "premium_expiry": premium_expiry,
                "premium_start_date": now if is_premium else None,
                "jersey_number": user_data.get("jersey_number"),
                "bio": f"Professional cricketer - {name}",
                "runs": user_data.get("runs", 0),
                "matches": user_data.get("matches", 0),
                "wickets": user_data.get("wickets", 0),
                "centuries": user_data.get("centuries", 0),
                "half_centuries": user_data.get("half_centuries", 0),
                "highest_score": user_data.get("highest_score", 0),
                "average_runs": user_data.get("average_runs", 0.0),
                "created_at": now,
                "updated_at": now,
            }
            
            # Store in Firestore using UID as document ID
            db.collection("users").document(uid).set(firestore_user)
            
            status = "[PREMIUM]" if is_premium else "[NON-PREMIUM]"
            print(f"      └─ Saved to Firestore: {status}\n")
            
            created_count += 1
            
        except auth_client.EmailAlreadyExistsError:
            print(f"[WARN] User already exists: {user_data['email']}\n")
            failed_count += 1
        except Exception as e:
            print(f"[ERROR] Failed to create {user_data['name']}: {str(e)}\n")
            failed_count += 1
    
    # Print summary
    print("\n" + "="*60)
    print(f"[SUCCESS] Successfully created: {created_count} users")
    print(f"[ERROR] Failed/Skipped: {failed_count} users")
    print(f"[TOTAL] {created_count + failed_count} attempts")
    print("="*60)
    
    # Count premium vs non-premium
    premium_count = sum(1 for u in DUMMY_USERS if u["is_premium"])
    non_premium_count = len(DUMMY_USERS) - premium_count
    print(f"\n[SUMMARY] User Distribution:")
    print(f"   [PREMIUM]: {premium_count}")
    print(f"   [NON-PREMIUM]: {non_premium_count}")
    print("="*60 + "\n")


if __name__ == "__main__":
    try:
        create_firebase_users()
    except KeyboardInterrupt:
        print("\n\n[WARN] Operation cancelled by user")
    except Exception as e:
        print(f"\n[ERROR] Error: {str(e)}")
