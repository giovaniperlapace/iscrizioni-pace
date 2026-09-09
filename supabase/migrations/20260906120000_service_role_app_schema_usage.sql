-- Maintenance: server RPCs already have EXECUTE on their app helpers, but
-- schema USAGE was missing for service_role in the deployed database.
-- No row changes, no CREATE grant, no additional function privileges or RLS changes.
begin;
grant usage on schema app to service_role;
commit;
