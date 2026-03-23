#!/usr/bin/env python3
"""
Fix Firestore users with inconsistent IDs.
Ensures all users have both 'id' and 'uid' fields set to their Firebase UID.
"""

import firebase_admin
from firebase_admin import credentials, firestore
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

def fix_user_ids():
    """Fix all users to have consistent Firebase UID-based IDs"""
    users_ref = db.collection('users')
    docs = users_ref.stream()
    
    fixed_count = 0
    total_count = 0
    
    print("[USER ID FIX] Starting user ID normalization...\n")
    
    for doc in docs:
        total_count += 1
        user_id = doc.id  # Document ID (Firebase UID)
        user_data = doc.to_dict()
        
        current_id = user_data.get('id')
        current_uid = user_data.get('uid')
        
        # Check if ID fields need fixing
        needs_fix = False
        
        # If id field is missing or is an integer (not Firebase UID style), fix it
        if not current_id or (isinstance(current_id, int) or (isinstance(current_id, str) and len(current_id) < 20)):
            needs_fix = True
            
        # If uid field is missing, fix it
        if not current_uid:
            needs_fix = True
        
        # If either id or uid doesn't match the document ID (Firebase UID), fix it
        if current_id != user_id or current_uid != user_id:
            needs_fix = True
        
        if needs_fix:
            user_name = user_data.get('name', 'Unknown')
            email = user_data.get('email', 'No email')
            
            print(f"[FIX] {user_name} ({email})")
            print(f"      Document ID: {user_id}")
            print(f"      Old 'id' field: {current_id}")
            print(f"      Old 'uid' field: {current_uid}")
            
            # Update both id and uid to match the document ID (Firebase UID)
            try:
                users_ref.document(user_id).update({
                    'id': user_id,
                    'uid': user_id,
                })
                print(f"      Status: [FIXED]")
                fixed_count += 1
            except Exception as e:
                print(f"      Status: [ERROR] {str(e)}")
            print()
    
    print("="*70)
    print(f"[RESULT] Fixed {fixed_count} out of {total_count} users")
    print("="*70)
    print("\nAll users should now use Firebase UID as both 'id' and 'uid'")

if __name__ == "__main__":
    try:
        fix_user_ids()
    except Exception as e:
        print(f"[ERROR] {str(e)}")
