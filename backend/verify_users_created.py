#!/usr/bin/env python3
"""Verify all created Firebase users"""

import firebase_admin
from firebase_admin import credentials, firestore
import os

cred_path = 'firebase-service-account.json'
if not firebase_admin._apps and os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
users_snap = list(db.collection('users').stream())
users = sorted(users_snap, key=lambda u: u.get('name', ''))

premium_users = [u for u in users if u.get('is_premium')]
non_premium_users = [u for u in users if not u.get('is_premium')]

print('='*80)
print('FIREBASE USERS CREATED')
print('='*80)
print(f'\n[PREMIUM USERS] ({len(premium_users)})')
print('-'*80)
for i, user in enumerate(premium_users, 1):
    data = user.to_dict()
    name = data.get('name', 'N/A')
    email = data.get('email', 'N/A')
    jersey = data.get('jersey_number', 0)
    runs = data.get('runs', 0)
    matches = data.get('matches', 0)
    wickets = data.get('wickets', 0)
    print(f'{i:2}. {name:30} | {email}')
    print(f'    Jersey: {jersey:3} | Runs: {runs:5} | Matches: {matches:3} | Wickets: {wickets:3}')

print(f'\n[NON-PREMIUM USERS] ({len(non_premium_users)})')
print('-'*80)
for i, user in enumerate(non_premium_users, 1):
    data = user.to_dict()
    name = data.get('name', 'N/A')
    email = data.get('email', 'N/A')
    jersey = data.get('jersey_number', 0)
    runs = data.get('runs', 0)
    matches = data.get('matches', 0)
    wickets = data.get('wickets', 0)
    print(f'{i:2}. {name:30} | {email}')
    print(f'    Jersey: {jersey:3} | Runs: {runs:5} | Matches: {matches:3} | Wickets: {wickets:3}')

print('\n' + '='*80)
print(f'TOTAL USERS: {len(users)} (Premium: {len(premium_users)}, Non-Premium: {len(non_premium_users)})')
print('='*80)
print('\nLogin credentials:')
print('  Password: Password@123 (for all users)')
print('='*80)
