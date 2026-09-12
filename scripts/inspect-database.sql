-- Read-only database inspection for Supabase/PostgreSQL.
-- This file only runs SELECT queries. It does not create or modify anything.

-- 1. All user-created tables and views.
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name;

-- 2. Columns for every user-created table/view.
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name, ordinal_position;

-- 3. Primary keys, foreign keys and unique constraints.
select
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema as referenced_table_schema,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
  and tc.table_name = kcu.table_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
  and tc.table_schema = ccu.table_schema
where tc.table_schema not in ('pg_catalog', 'information_schema')
order by tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- 4. Quick search for likely accommodation/guest/property tables.
select
  table_schema,
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
  and (
    lower(table_name) like any (array['%property%', '%properties%', '%accommodation%', '%guest%', '%user%', '%booking%', '%stay%'])
    or lower(column_name) like any (array['%property%', '%accommodation%', '%guest%', '%user%', '%telegram%', '%address%', '%booking%', '%stay%'])
  )
order by table_schema, table_name, ordinal_position;
