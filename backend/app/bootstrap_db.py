"""CLI: python -m app.bootstrap_db"""

from app.db_startup import bootstrap_database

if __name__ == "__main__":
    bootstrap_database()
    print("Database bootstrap complete.")
