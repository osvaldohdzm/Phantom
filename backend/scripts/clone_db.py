import os
import sys
import psycopg2

def main():
    source_db = os.getenv("SOURCE_DB", "katana_security_db")
    target_db = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB")
    
    if not target_db:
        print("Error: DB_NAME or POSTGRES_DB environment variable is not defined.")
        sys.exit(1)
        
    if source_db == target_db:
        print(f"Skipping database clone: source and target are the same ({source_db}).")
        sys.exit(0)

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "299792458.Light")

    print(f"Cloning PostgreSQL database '{source_db}' into '{target_db}'...")

    try:
        # Connect to postgres default database to execute drop/create commands
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database="postgres"
        )
        conn.autocommit = True
        cur = conn.cursor()

        # Terminate active connections to both source and target databases
        cur.execute(f"""
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname IN ('{source_db}', '{target_db}')
              AND pid <> pg_backend_pid();
        """)

        # Drop the target database if it exists
        cur.execute(f"DROP DATABASE IF EXISTS {target_db};")

        # Create target database using source database as template
        cur.execute(f"CREATE DATABASE {target_db} TEMPLATE {source_db};")

        print(f"Database '{target_db}' successfully cloned from '{source_db}'.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Warning: Failed to clone PostgreSQL database: {e}")
        print("Make sure PostgreSQL is running, the source database exists, and the credentials are correct.")
        # We don't exit with error here so that the application can still fall back to its internal schema creations if PostgreSQL cloning is not desired
        sys.exit(0)

if __name__ == "__main__":
    main()
