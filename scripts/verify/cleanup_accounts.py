"""Removes the test accounts the verification scripts create (e-mails ending in @atlethera.test).

Usage: python scripts/verify/cleanup_accounts.py   (needs SUPABASE_SECRET_KEY in .env.local)
"""
import sys

from supa import SECRET, configured, delete_test_users

if not configured() or not SECRET:
    print("Supabase is not configured (.env.local): nothing to clean.")
    sys.exit(0)
print(f"Removed {delete_test_users()} test accounts.")
