-- grant_premium() is SECURITY DEFINER with no caller check, so it must never be
-- callable with the public anon key. Only the server (service_role, used by
-- api/admin-ops.js and the Paystack webhook) may execute it.
revoke execute on function public.grant_premium(uuid, text, integer, text) from public, anon, authenticated;
grant  execute on function public.grant_premium(uuid, text, integer, text) to service_role;
