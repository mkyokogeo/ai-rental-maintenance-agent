"""Read-only inspection of the PostgreSQL database configured in .env."""

from pathlib import Path
from urllib.parse import quote, urlparse
import os
import sys

try:
    import psycopg
except ImportError:
    print('Falta psycopg. Instala el driver con: pip install "psycopg[binary]"')
    raise SystemExit(1)


def load_database_url():
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.exists():
        raise RuntimeError(f"No existe {env_file}")

    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")

    raise RuntimeError("DATABASE_URL no está definida en .env")


def candidate_urls(database_url):
    yield "direct", database_url

    parsed = urlparse(database_url)
    host = parsed.hostname or ""
    if host.startswith("db.") and host.endswith(".supabase.co"):
        project_ref = host.split(".")[1]
        pooler_user = f"{parsed.username}.{project_ref}"
        yield (
            "session pooler",
            (
                f"postgresql://{quote(pooler_user, safe='')}:{quote(parsed.password or '', safe='')}"
                f"@aws-1-eu-west-1.pooler.supabase.com:5432{parsed.path}?sslmode=require"
            ),
        )


def connect(database_url):
    last_error = None
    for label, url in candidate_urls(database_url):
        try:
            connection = psycopg.connect(url, connect_timeout=15)
            print(f"Conectado por {label}")
            return connection
        except Exception as error:
            last_error = error
            print(f"Falló {label}: {error}")
    raise RuntimeError(last_error)


def main():
    database_url = load_database_url()
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                select table_schema, table_name, table_type
                from information_schema.tables
                where table_schema not in ('pg_catalog', 'information_schema')
                order by table_schema, table_name
            """)
            print("\nTABLES")
            for schema, table, table_type in cursor.fetchall():
                print(f"- {schema}.{table} ({table_type})")

            cursor.execute("""
                select table_schema, table_name, ordinal_position,
                       column_name, data_type, is_nullable
                from information_schema.columns
                where table_schema not in ('pg_catalog', 'information_schema')
                order by table_schema, table_name, ordinal_position
            """)
            print("\nCOLUMNS")
            for schema, table, position, column, data_type, nullable in cursor.fetchall():
                print(f"- {schema}.{table}.{column} | {data_type} | nullable={nullable}")

            cursor.execute("""
                select current_user,
                       current_database(),
                       has_schema_privilege(current_user, 'public', 'CREATE')
            """)
            user, database, can_create = cursor.fetchone()
            print("\nPERMISSIONS")
            print(f"- database: {database}")
            print(f"- database user: {user}")
            print(f"- can create tables in public: {can_create}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"No se pudo conectar o consultar la base de datos: {error}")
        raise SystemExit(1)
