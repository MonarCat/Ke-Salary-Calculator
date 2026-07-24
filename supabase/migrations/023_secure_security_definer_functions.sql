-- Harden all known SECURITY DEFINER functions. PostgreSQL grants EXECUTE to
-- PUBLIC by default, so every RPC-capable function receives explicit grants.

-- Poll RPCs deliberately bypass RLS because polls support anonymous visitors.
-- They use only qualified objects, fixed input ranges, and anon/auth grants.
CREATE OR REPLACE FUNCTION public.get_poll_participant_count(p_poll_idx INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_poll_idx NOT BETWEEN 0 AND 11 THEN
    RAISE EXCEPTION 'Invalid poll index';
  END IF;

  RETURN (SELECT count(*)::BIGINT FROM public.poll_participants WHERE poll_idx = p_poll_idx);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_poll_vote(p_poll_idx SMALLINT, p_option_idx SMALLINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_poll_idx NOT BETWEEN 0 AND 11 OR p_option_idx NOT BETWEEN 0 AND 3 THEN
    RAISE EXCEPTION 'Invalid poll selection';
  END IF;

  INSERT INTO public.poll_votes (poll_idx, option_idx, count)
  VALUES (p_poll_idx, p_option_idx, 1)
  ON CONFLICT (poll_idx, option_idx)
  DO UPDATE SET count = public.poll_votes.count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_poll_vote(
  p_poll_idx INTEGER,
  p_anon_token TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_option_idx INTEGER;
BEGIN
  IF p_poll_idx NOT BETWEEN 0 AND 11 THEN
    RAISE EXCEPTION 'Invalid poll index';
  END IF;

  IF v_user_id IS NULL AND p_anon_token IS NOT NULL
     AND char_length(p_anon_token) NOT BETWEEN 16 AND 256 THEN
    RAISE EXCEPTION 'Invalid anonymous vote token';
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT option_idx INTO v_option_idx
    FROM public.poll_participants
    WHERE poll_idx = p_poll_idx AND user_id = v_user_id
    LIMIT 1;
  ELSIF p_anon_token IS NOT NULL THEN
    SELECT option_idx INTO v_option_idx
    FROM public.poll_participants
    WHERE poll_idx = p_poll_idx AND anon_token = p_anon_token
    LIMIT 1;
  END IF;

  RETURN json_build_object('already_voted', v_option_idx IS NOT NULL, 'option_idx', v_option_idx);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_poll_vote(
  p_poll_idx INTEGER,
  p_option_idx INTEGER,
  p_anon_token TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_previous_option INTEGER;
BEGIN
  IF p_poll_idx NOT BETWEEN 0 AND 11 OR p_option_idx NOT BETWEEN 0 AND 3 THEN
    RAISE EXCEPTION 'Invalid poll selection';
  END IF;

  IF v_user_id IS NULL AND (p_anon_token IS NULL OR char_length(p_anon_token) NOT BETWEEN 16 AND 256) THEN
    RAISE EXCEPTION 'A valid anonymous vote token is required';
  END IF;

  BEGIN
    INSERT INTO public.poll_participants (poll_idx, user_id, anon_token, option_idx)
    VALUES (p_poll_idx, v_user_id, CASE WHEN v_user_id IS NULL THEN p_anon_token ELSE NULL END, p_option_idx);
  EXCEPTION WHEN unique_violation THEN
    SELECT option_idx INTO v_previous_option
    FROM public.poll_participants
    WHERE poll_idx = p_poll_idx
      AND ((v_user_id IS NOT NULL AND user_id = v_user_id)
        OR (v_user_id IS NULL AND anon_token = p_anon_token))
    LIMIT 1;
    RETURN json_build_object('already_voted', TRUE, 'option_idx', v_previous_option);
  END;

  INSERT INTO public.poll_votes (poll_idx, option_idx, count)
  VALUES (p_poll_idx, p_option_idx, 1)
  ON CONFLICT (poll_idx, option_idx)
  DO UPDATE SET count = public.poll_votes.count + 1;

  RETURN json_build_object('already_voted', FALSE, 'option_idx', p_option_idx);
END;
$$;

REVOKE ALL ON FUNCTION public.get_poll_participant_count(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_poll_vote(SMALLINT, SMALLINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_poll_vote(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_poll_vote(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_participant_count(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_poll_vote(SMALLINT, SMALLINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_poll_vote(INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_poll_vote(INTEGER, INTEGER, TEXT) TO anon, authenticated;

-- check_premium_active only reads data already protected by user_profiles RLS;
-- it does not need definer privileges.
DO $$
BEGIN
  IF to_regprocedure('public.check_premium_active(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.check_premium_active(uuid) SECURITY INVOKER';
    EXECUTE 'ALTER FUNCTION public.check_premium_active(uuid) SET search_path TO ''''';
    EXECUTE 'REVOKE ALL ON FUNCTION public.check_premium_active(uuid) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_premium_active(uuid) TO authenticated, service_role';
  END IF;
END;
$$;

-- Existing deployment-specific functions are optional in a clean migration
-- history. If present, fix their search path and replace implicit PUBLIC grants
-- with the smallest role set required by their existing callers.
DO $$
DECLARE
  target TEXT;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.handle_org_trial()',
    'public.auto_activate_org_trial()',
    'public.grant_premium(text,text,integer)',
    'public.grant_premium(uuid,text,integer,text)',
    'public.get_user_id_by_email(text)',
    'public.activate_trial_by_email(text)'
  ]
  LOOP
    IF to_regprocedure(target) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path TO %L', target, '');
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', target);
      IF target NOT IN ('public.handle_new_user()', 'public.handle_org_trial()', 'public.auto_activate_org_trial()') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', target);
      END IF;
    END IF;
  END LOOP;

  FOREACH target IN ARRAY ARRAY[
    'public.is_admin(uuid)',
    'public.is_super_admin()',
    'public.is_super_admin(uuid)',
    'public.grant_admin_access(text)',
    'public.get_pending_comments()',
    'public.get_all_users()',
    'public.get_all_employers()'
  ]
  LOOP
    IF to_regprocedure(target) IS NOT NULL THEN
      -- Some legacy admin bodies use unqualified public tables. Keep a fixed,
      -- pg_catalog-first path until those legacy bodies are replaced.
      EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog, public', target);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', target);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', target);
    END IF;
  END LOOP;

  IF to_regprocedure('public.get_blog_stats()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_blog_stats() SET search_path TO pg_catalog, public';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_blog_stats() FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_blog_stats() TO service_role';
  END IF;

  IF to_regclass('public.admin_users') IS NOT NULL
     AND to_regclass('public.user_profiles') IS NOT NULL
     AND to_regclass('public.employers') IS NOT NULL
     AND to_regprocedure('public.is_admin(uuid)') IS NOT NULL THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
      RETURNS TABLE(total_users BIGINT, total_organizations BIGINT)
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $body$
      BEGIN
        IF NOT public.is_admin() THEN
          RAISE EXCEPTION 'Admin access required';
        END IF;

        RETURN QUERY SELECT count(*)::BIGINT, (SELECT count(*)::BIGINT FROM public.employers)
        FROM public.user_profiles;
      END;
      $body$;
    $function$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated, service_role';
  END IF;

  IF to_regprocedure('public.increment_post_views_realtime(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.increment_post_views_realtime(uuid) SET search_path TO pg_catalog, public';
    EXECUTE 'REVOKE ALL ON FUNCTION public.increment_post_views_realtime(uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.increment_post_views_realtime(uuid) TO anon, authenticated';
  END IF;
END;
$$;
