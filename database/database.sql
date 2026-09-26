--
-- PostgreSQL database dump
--


-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: prj_-jPU4p7xAmeh; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_-jPU4p7xAmeh";


--
-- Name: prj_-jPU4p7xAmeh_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_-jPU4p7xAmeh_auth";


--
-- Name: prj_-jPU4p7xAmeh_storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_-jPU4p7xAmeh_storage";


--
-- Name: auto_confirm_new_auth_user(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".auto_confirm_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;


--
-- Name: btown_allowlist_remove(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_allowlist_remove(p_email text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  touched integer;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_allowlist_remove is restricted TO the service role';
  END IF;
  DELETE FROM admin_allowlist WHERE lower(email) = lower(p_email);
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;


--
-- Name: btown_auth_authorize_session(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_authorize_session(p_token_hash text) RETURNS TABLE(user_id uuid, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_hash text;
  v_id bigint := NULL;
  v_user uuid := NULL;
  v_exp timestamptz := NULL;
  r record;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_authorize_session is restricted TO the service role';
  END IF;

  v_hash := lower(btrim(coalesce(p_token_hash, '')));
  IF v_hash = '' THEN
    RETURN;
  END IF;

  FOR r IN SELECT s.id, s.user_id, s.token_hash, s.expires_at, s.revoked_at
             FROM auth_sessions s
            ORDER BY s.id DESC
  LOOP
    IF lower(btrim(coalesce(r.token_hash, ''))) = v_hash
       AND r.revoked_at IS NULL
       AND r.expires_at > now() THEN
      v_id := r.id;
      v_user := r.user_id;
      EXIT;
    END IF;
  END LOOP;

  IF v_id IS NULL OR v_user IS NULL THEN
    RETURN;
  END IF;

  UPDATE auth_sessions s
     SET last_seen_at = now(),
         expires_at = now() + interval '7 days'
   WHERE s.id = v_id;

  SELECT s.expires_at INTO v_exp FROM auth_sessions s WHERE s.id = v_id;

  user_id := v_user;
  expires_at := coalesce(v_exp, now() + interval '7 days');
  RETURN NEXT;
END
$$;


--
-- Name: btown_auth_cleanup_reset_tokens(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_cleanup_reset_tokens() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  touched integer;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_cleanup_reset_tokens is restricted TO the service role';
  END IF;
  DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;


--
-- Name: btown_auth_lookup(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_lookup(p_email text) RETURNS TABLE(id uuid, email text, full_name text, role text, is_active boolean, password_hash text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_lookup is restricted TO the service role';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email::text, p.full_name::text, p.role::text, p.is_active, p.password_hash::text
    FROM profiles p
    WHERE lower(p.email) = lower(p_email)
    ORDER BY p.created_at
    LIMIT 1;
END;
$$;


--
-- Name: btown_auth_lookup_id(uuid); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_lookup_id(p_user_id uuid) RETURNS TABLE(id uuid, email text, full_name text, role text, is_active boolean, password_hash text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_lookup_id is restricted TO the service role';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email::text, p.full_name::text, p.role::text, p.is_active, p.password_hash::text
    FROM profiles p
    WHERE p.id = p_user_id
    LIMIT 1;
END;
$$;


--
-- Name: btown_auth_revoke_sessions(uuid, text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_revoke_sessions(p_user_id uuid, p_keep_hash text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  touched integer;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_revoke_sessions is restricted TO the service role';
  END IF;
  UPDATE auth_sessions
     SET revoked_at = now()
   WHERE user_id = p_user_id
     AND revoked_at IS NULL
     AND (p_keep_hash IS NULL OR token_hash <> p_keep_hash);
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;


--
-- Name: btown_auth_roles(uuid); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_roles(p_user_id uuid) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  out_roles text[];
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_roles is restricted TO the service role';
  END IF;
  SELECT coalesce(array_agg(DISTINCT r.role::text), ARRAY[]::text[])
    INTO out_roles
    FROM user_roles r
   WHERE r.user_id = p_user_id;
  RETURN coalesce(out_roles, ARRAY[]::text[]);
END;
$$;


--
-- Name: btown_auth_session(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_session(p_token_hash text) RETURNS TABLE(user_id uuid, expires_at timestamp with time zone, revoked_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_session is restricted TO the service role';
  END IF;
  RETURN QUERY
    SELECT s.user_id, s.expires_at, s.revoked_at
      FROM auth_sessions s
     WHERE s.token_hash = p_token_hash
     ORDER BY s.expires_at DESC
     LIMIT 1;
END;
$$;


--
-- Name: btown_auth_set_password(uuid, text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_set_password(p_user_id uuid, p_hash text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  touched integer;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_set_password is restricted TO the service role';
  END IF;
  UPDATE profiles
     SET password_hash = p_hash,
         password_updated_at = now()
   WHERE id = p_user_id;
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched > 0;
END;
$$;


--
-- Name: btown_auth_set_roles(uuid, text[], uuid); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_set_roles(p_user_id uuid, p_roles text[], p_actor uuid) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  wanted text[];
  summary text;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_set_roles is restricted TO the service role';
  END IF;

  SELECT coalesce(array_agg(DISTINCT r), ARRAY[]::text[]) INTO wanted
    FROM unnest(coalesce(p_roles, ARRAY[]::text[])) AS r
   WHERE r IN ('admin', 'dispatcher', 'viewer', 'customer');

  DELETE FROM user_roles ur
   WHERE ur.user_id = p_user_id
     AND NOT (ur.role::text = ANY (wanted));

  INSERT INTO user_roles (user_id, role, granted_by)
  SELECT p_user_id, w, p_actor
    FROM unnest(wanted) AS w
   WHERE NOT EXISTS (
     SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = p_user_id AND ur2.role::text = w
   );

  summary := CASE
    WHEN 'admin' = ANY (wanted) THEN 'admin'
    WHEN 'dispatcher' = ANY (wanted) THEN 'dispatcher'
    WHEN 'viewer' = ANY (wanted) THEN 'viewer'
    WHEN 'customer' = ANY (wanted) THEN 'customer'
    ELSE 'pending_staff'
  END;

  UPDATE profiles SET role = summary WHERE id = p_user_id;
  RETURN wanted;
END;
$$;


--
-- Name: btown_auth_touch_session(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_touch_session(p_token_hash text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_touch_session is restricted TO the service role';
  END IF;
  UPDATE auth_sessions
     SET last_seen_at = now(),
         expires_at = now() + interval '7 days'
   WHERE token_hash = p_token_hash
     AND revoked_at IS NULL;
END;
$$;


--
-- Name: btown_auth_use_reset_token(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_auth_use_reset_token(p_token_hash text) RETURNS TABLE(user_id uuid, email text, scope text, outcome text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  tok record;
  now_ts timestamptz := now();
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'btown_auth_use_reset_token is restricted TO the service role';
  END IF;

  SELECT t.id, t.user_id, t.email, t.scope, t.expires_at, t.used_at
    INTO tok
    FROM password_reset_tokens t
   WHERE t.token_hash = p_token_hash
   LIMIT 1;

  IF tok.id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, 'unknown_token'::text;
    RETURN;
  END IF;
  IF tok.used_at IS NOT NULL THEN
    UPDATE password_reset_tokens t SET attempts = coalesce(t.attempts, 0) + 1 WHERE t.id = tok.id;
    RETURN QUERY SELECT tok.user_id, tok.email::text, tok.scope::text, 'already_used'::text;
    RETURN;
  END IF;
  IF tok.expires_at <= now_ts THEN
    UPDATE password_reset_tokens t SET attempts = coalesce(t.attempts, 0) + 1 WHERE t.id = tok.id;
    RETURN QUERY SELECT tok.user_id, tok.email::text, tok.scope::text, 'expired'::text;
    RETURN;
  END IF;

  UPDATE password_reset_tokens t SET used_at = now_ts WHERE t.id = tok.id;
  UPDATE password_reset_tokens t SET used_at = now_ts
   WHERE t.user_id = tok.user_id AND t.used_at IS NULL;
  RETURN QUERY SELECT tok.user_id, tok.email::text, tok.scope::text, 'usable'::text;
END
$$;


--
-- Name: btown_random_hex(integer); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".btown_random_hex(p_bytes integer) RETURNS text
    LANGUAGE sql
    AS $$
  select encode(gen_random_bytes(greatest(1, least(coalesce(p_bytes, 32), 64))), 'hex')
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: crm_campaigns; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text,
    html_body text,
    text_body text,
    channel text DEFAULT 'email'::text NOT NULL,
    status text DEFAULT 'draft'::text,
    list_id uuid,
    filter_query jsonb,
    list_ids jsonb,
    style_preset text,
    images jsonb,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    total_recipients integer DEFAULT 0,
    total_sent integer DEFAULT 0,
    total_opened integer DEFAULT 0,
    total_clicked integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    from_name text,
    goal_id uuid,
    CONSTRAINT crm_campaigns_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text]))),
    CONSTRAINT crm_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: crm_campaigns_claim_due(integer); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".crm_campaigns_claim_due(p_limit integer) RETURNS SETOF "prj_-jPU4p7xAmeh".crm_campaigns
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY UPDATE crm_campaigns
  SET status = 'sending', sent_at = NULL
  WHERE id IN (
    SELECT due_id FROM (
      SELECT id AS due_id FROM crm_campaigns
      WHERE status = 'scheduled' AND scheduled_at <= NOW()
      ORDER BY scheduled_at
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
    ) due_rows
  )
  RETURNING *;
END $$;


--
-- Name: crm_flow_step_queue; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_flow_step_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    resume_step_order integer NOT NULL,
    run_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_flow_queue_claim(integer, text, integer); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".crm_flow_queue_claim(p_limit integer, p_worker text, p_lock_seconds integer DEFAULT 300) RETURNS SETOF "prj_-jPU4p7xAmeh".crm_flow_step_queue
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY UPDATE crm_flow_step_queue
  SET locked_at = NOW(),
      locked_by = p_worker,
      attempts = attempts + 1
  WHERE id IN (
    SELECT due_id FROM (
      SELECT id AS due_id FROM crm_flow_step_queue
      WHERE finished_at IS NULL
        AND attempts < max_attempts
        AND run_at <= NOW()
        AND (locked_at IS NULL OR locked_at < NOW() - make_interval(secs => p_lock_seconds))
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
    ) due_rows
  )
  RETURNING *;
END $$;


--
-- Name: crm_goal_work; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_goal_work (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    not_before timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    locked_at timestamp with time zone,
    locked_by text,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_goal_work_kind_check CHECK ((kind = ANY (ARRAY['rematch'::text, 'classify'::text, 'reply'::text, 'evaluate'::text, 'send'::text]))),
    CONSTRAINT crm_goal_work_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text])))
);


--
-- Name: crm_goal_work_claim(integer, text, integer); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".crm_goal_work_claim(p_limit integer, p_worker text, p_lock_seconds integer DEFAULT 300) RETURNS SETOF "prj_-jPU4p7xAmeh".crm_goal_work
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY UPDATE crm_goal_work
  SET locked_at = NOW(),
      locked_by = p_worker,
      status = 'processing',
      attempts = attempts + 1
  WHERE id IN (
    SELECT due_id FROM (
      SELECT id AS due_id FROM crm_goal_work
      WHERE finished_at IS NULL
        AND status IN ('pending', 'processing')
        AND attempts < max_attempts
        AND not_before <= NOW()
        AND (locked_at IS NULL OR locked_at < NOW() - make_interval(secs => p_lock_seconds))
      ORDER BY not_before
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
    ) due_rows
  )
  RETURNING *;
END $$;


--
-- Name: crm_sends; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid,
    campaign_id uuid,
    flow_id uuid,
    contact_id uuid,
    direction text DEFAULT 'outbound'::text NOT NULL,
    source text,
    created_by text,
    status text DEFAULT 'draft'::text NOT NULL,
    to_email text,
    from_email text,
    subject text,
    body text,
    draft_body text,
    approved_by text,
    approved_at timestamp with time zone,
    mailgun_message_id text,
    in_reply_to text,
    thread_references text,
    idempotency_key text,
    error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    sent_at timestamp with time zone,
    locked_at timestamp with time zone,
    locked_by text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    channel text DEFAULT 'email'::text NOT NULL,
    to_phone text,
    from_name text,
    body_html text,
    scheduled_at timestamp with time zone,
    CONSTRAINT crm_sends_direction_check CHECK ((direction = ANY (ARRAY['outbound'::text, 'inbound'::text]))),
    CONSTRAINT crm_sends_source_check CHECK ((source = ANY (ARRAY['campaign'::text, 'flow'::text, 'reply'::text, 'manual'::text]))),
    CONSTRAINT crm_sends_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text, 'received'::text])))
);


--
-- Name: crm_sends_claim_due(integer, text, integer); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".crm_sends_claim_due(p_limit integer, p_worker text, p_lock_seconds integer DEFAULT 300) RETURNS SETOF "prj_-jPU4p7xAmeh".crm_sends
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY UPDATE crm_sends
  SET status = 'sending',
      locked_at = NOW(),
      locked_by = p_worker,
      attempts = attempts + 1
  WHERE id IN (
    SELECT due_id FROM (
      SELECT id AS due_id FROM crm_sends
      WHERE direction = 'outbound'
        AND status = 'approved'
        AND attempts < max_attempts
        AND (scheduled_at IS NULL OR scheduled_at <= NOW())
        AND (locked_at IS NULL OR locked_at < NOW() - make_interval(secs => p_lock_seconds))
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
    ) due_rows
  )
  RETURNING *;
END $$;


--
-- Name: crm_submit_contact(text, text, text, boolean, text, jsonb); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".crm_submit_contact(p_email text, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_sms_opt_in boolean DEFAULT false, p_source text DEFAULT 'website-form'::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
  v_email TEXT;
  v_id UUID;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' OR length(v_email) > 320
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;
  IF length(coalesce(p_name, '')) > 200
     OR length(coalesce(p_phone, '')) > 40
     OR length(coalesce(p_source, '')) > 100
     OR length(coalesce(p_metadata::text, '')) > 4000 THEN
    RAISE EXCEPTION 'field too long';
  END IF;

  -- Schema-qualified because the header pins search_path to '': a bare name
  -- resolves against nothing and the call fails with "relation crm_contacts
  -- does not exist". `public.` is rewritten TO this tenant's schema by
  -- DatabasePad, so this is the portable spelling. The ON CONFLICT clause
  -- below still says `crm_contacts` unqualified — that is a reference TO the
  -- INSERT's target relation, not a search_path lookup.
  INSERT INTO "prj_-jPU4p7xAmeh".crm_contacts (email, name, phone, sms_opt_in, source, metadata,
                            subscribed, subscribed_at)
  VALUES (v_email, nullif(trim(p_name), ''), nullif(trim(p_phone), ''),
          coalesce(p_sms_opt_in, FALSE), coalesce(p_source, 'website-form'),
          coalesce(p_metadata, '{}'), TRUE, NOW())
  ON CONFLICT (email) DO UPDATE SET
    name = coalesce(nullif(trim(EXCLUDED.name), ''), crm_contacts.name),
    phone = coalesce(nullif(trim(EXCLUDED.phone), ''), crm_contacts.phone),
    sms_opt_in = crm_contacts.sms_opt_in OR coalesce(EXCLUDED.sms_opt_in, FALSE),
    metadata = crm_contacts.metadata || coalesce(EXCLUDED.metadata, '{}'),
    subscribed = TRUE,
    subscribed_at = CASE WHEN crm_contacts.subscribed THEN crm_contacts.subscribed_at ELSE NOW() END,
    unsubscribed_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$_$;


--
-- Name: current_role_name(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".current_role_name() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select role from profiles where id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid and is_active
$$;


--
-- Name: current_user_email(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".current_user_email() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select lower(email) from profiles
  where id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    and is_active
$$;


--
-- Name: enforce_admin_allowlist(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".enforce_admin_allowlist() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if is_approved_admin_email(new.email) then
    if tg_op = 'INSERT' then
      new.role := 'admin';
      new.is_active := true;
    elsif new.role in ('customer', 'pending_staff') then
      new.role := 'admin';
    end if;
  end if;
  return new;
end $$;


--
-- Name: handle_new_user_bootstrap(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".handle_new_user_bootstrap() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_email text;
  v_name text;
  v_door text;
begin
  v_email := lower(coalesce(new.email, ''));
  if v_email = '' then
    return new;
  end if;
  v_name := nullif(new.raw_user_meta_data->>'full_name', '');
  v_door := coalesce(nullif(new.raw_user_meta_data->>'signup_door', ''), 'customer');
  insert into profiles (id, email, full_name, role, is_active)
  values (new.id, v_email, v_name, resolve_signup_role(v_email, v_door), true)
  on conflict (id) do nothing;
  return new;
end $$;


--
-- Name: has_role(uuid, text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".has_role(p_user_id uuid, p_role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (select 1 from user_roles ur where ur.user_id = p_user_id and ur.role = p_role)
$$;


--
-- Name: is_active_user(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".is_active_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (select 1 from profiles where id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid and is_active)
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from profiles p
    where p.id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      and p.is_active and has_role(p.id, 'admin')
  )
$$;


--
-- Name: is_approved_admin_email(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".is_approved_admin_email(p_email text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  wanted text;
  hit boolean := false;
  r record;
BEGIN
  wanted := lower(btrim(coalesce(p_email, '')));
  IF wanted = '' THEN
    RETURN false;
  END IF;
  FOR r IN SELECT a.email FROM admin_allowlist a LOOP
    IF lower(btrim(coalesce(r.email, ''))) = wanted THEN
      hit := true;
      EXIT;
    END IF;
  END LOOP;
  RETURN hit;
END
$$;


--
-- Name: is_customer(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".is_customer() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from profiles p
    where p.id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      and p.is_active and has_role(p.id, 'customer')
  )
$$;


--
-- Name: is_internal_user(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".is_internal_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from profiles p
    where p.id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      and p.is_active and (has_role(p.id, 'admin') or has_role(p.id, 'dispatcher') or has_role(p.id, 'viewer'))
  )
$$;


--
-- Name: is_staff(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from profiles p
    where p.id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      and p.is_active and (has_role(p.id, 'admin') or has_role(p.id, 'dispatcher'))
  )
$$;


--
-- Name: log_audit(uuid, text, text, text, text, jsonb); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".log_audit(p_actor uuid, p_email text, p_action text, p_entity text, p_entity_id text, p_meta jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  insert into audit_log (actor_id, actor_email, action, entity, entity_id, metadata)
  values (p_actor, p_email, p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb))
$$;


--
-- Name: my_roles(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".my_roles() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select roles_of(NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid)
$$;


--
-- Name: normalize_bcrypt_prefix(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".normalize_bcrypt_prefix() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
begin
  if new.encrypted_password is not null and left(new.encrypted_password, 4) = '$2b$' then
    new.encrypted_password := '$2a$' || substring(new.encrypted_password from 5);
  end if;
  return new;
end $_$;


--
-- Name: resolve_signup_role(text, text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".resolve_signup_role(p_email text, p_door text DEFAULT 'customer'::text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
declare
  v_admins integer;
begin
  if is_approved_admin_email(p_email) then
    return 'admin';
  end if;
  select count(*) into v_admins from profiles where role = 'admin';
  if v_admins = 0 and coalesce(p_door, '') = 'staff' then
    return 'admin';
  end if;
  if coalesce(p_door, '') = 'staff' then
    return 'pending_staff';
  end if;
  return 'customer';
end $$;


--
-- Name: rl_hit(text, integer, integer); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".rl_hit(p_key text, p_limit integer, p_window_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_row rate_limits;
begin
  select * into v_row from rate_limits where key = p_key for update;
  if not found then
    insert into rate_limits (key, window_start, count) values (p_key, now(), 1);
    return true;
  end if;
  if v_row.window_start < now() - make_interval(secs => p_window_seconds) then
    update rate_limits set window_start = now(), count = 1 where key = p_key;
    return true;
  end if;
  if v_row.count >= p_limit then
    return false;
  end if;
  update rate_limits set count = count + 1 where key = p_key;
  return true;
end $$;


--
-- Name: roles_of(uuid); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".roles_of(p_user_id uuid) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select coalesce(array_agg(ur.role order by ur.role), '{}'::text[])
  from user_roles ur where ur.user_id = p_user_id
$$;


--
-- Name: seed_profile_roles(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".seed_profile_roles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.role in ('admin','dispatcher','viewer','customer') then
    insert into user_roles (user_id, role) values (new.id, new.role) on conflict do nothing;
  end if;
  if is_approved_admin_email(new.email) then
    insert into user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return null;
end $$;


--
-- Name: sync_profile_summary_role(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".sync_profile_summary_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_uid uuid;
  v_role text;
  v_current text;
begin
  if tg_op = 'DELETE' then
    v_uid := old.user_id;
  else
    v_uid := new.user_id;
  end if;

  select case
    when exists (select 1 from user_roles where user_id = v_uid and role = 'admin') then 'admin'
    when exists (select 1 from user_roles where user_id = v_uid and role = 'dispatcher') then 'dispatcher'
    when exists (select 1 from user_roles where user_id = v_uid and role = 'viewer') then 'viewer'
    when exists (select 1 from user_roles where user_id = v_uid and role = 'customer') then 'customer'
    else null end
  into v_role;

  if v_role is null then
    return null;
  end if;

  select role into v_current from profiles where id = v_uid;
  if v_current is distinct from v_role then
    if is_approved_admin_email((select email from profiles where id = v_uid)) then
      update profiles set role = 'admin' where id = v_uid;
    else
      update profiles set role = v_role where id = v_uid;
    end if;
  end if;
  return null;
end $$;


--
-- Name: tg_audit(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".tg_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_entity_id text;
  v_meta jsonb;
begin
  if TG_OP = 'DELETE' then
    v_entity_id := to_jsonb(OLD) ->> 'id';
    v_meta := jsonb_build_object('old', to_jsonb(OLD));
  elsif TG_OP = 'UPDATE' then
    v_entity_id := to_jsonb(NEW) ->> 'id';
    v_meta := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  else
    v_entity_id := to_jsonb(NEW) ->> 'id';
    v_meta := jsonb_build_object('new', to_jsonb(NEW));
  end if;

  insert into audit_log (actor_id, actor_email, action, entity, entity_id, metadata)
  values (
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (select email from profiles where id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid),
    lower(TG_OP) || '.' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    v_entity_id,
    v_meta
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end $$;


--
-- Name: tg_audit_user_roles(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".tg_audit_user_roles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_uid uuid;
  v_role text;
  v_actor uuid;
  v_actor_email text;
  v_target_email text;
begin
  if tg_op = 'DELETE' then
    v_uid := old.user_id;
    v_role := old.role;
  else
    v_uid := new.user_id;
    v_role := new.role;
  end if;

  v_actor := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
  select email into v_actor_email from profiles where id = v_actor;
  select email into v_target_email from profiles where id = v_uid;

  perform log_audit(
    v_actor,
    v_actor_email,
    case when tg_op = 'DELETE' then 'user.role_removed' else 'user.role_granted' end,
    'user_roles',
    v_uid::text,
    jsonb_build_object('role', v_role, 'target_email', v_target_email)
  );
  return null;
end $$;


--
-- Name: tg_profile_role_ensure(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".tg_profile_role_ensure() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.role in ('admin','dispatcher','viewer','customer') then
    insert into user_roles (user_id, role) values (new.id, new.role) on conflict do nothing;
  end if;
  return null;
end $$;


--
-- Name: tg_touch_updated_at(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".tg_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  NEW.updated_at := now();
  return NEW;
end $$;


--
-- Name: throttle_clear(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".throttle_clear(p_key text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  delete from auth_throttle where key = p_key
$$;


--
-- Name: throttle_fail(text, integer, integer); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".throttle_fail(p_key text, p_max integer, p_lock_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_fails integer;
begin
  insert into auth_throttle (key, fails, updated_at) values (p_key, 1, now())
  on conflict (key) do update set fails = auth_throttle.fails + 1, updated_at = now()
  returning fails into v_fails;

  if v_fails >= p_max then
    update auth_throttle set locked_until = now() + make_interval(secs => p_lock_seconds), fails = 0
    where key = p_key;
    return true;
  end if;
  return false;
end $$;


--
-- Name: throttle_locked(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh".throttle_locked(p_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select coalesce((select locked_until > now() from auth_throttle where key = p_key), false)
$$;


--
-- Name: auth_uid(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh_auth".auth_uid() RETURNS uuid
    LANGUAGE sql
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;


--
-- Name: role(); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh_auth".role() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.role', true), 'anon')
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE FUNCTION "prj_-jPU4p7xAmeh_storage".foldername(name text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT string_to_array(name, '/')
$$;


--
-- Name: admin_allowlist; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".admin_allowlist (
    email text NOT NULL,
    note text,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".audit_log (
    id bigint NOT NULL,
    actor_id uuid,
    actor_email text,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "prj_-jPU4p7xAmeh".audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_sessions; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".auth_sessions (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    ip_hash text,
    user_agent text
);


--
-- Name: auth_sessions_id_seq; Type: SEQUENCE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".auth_sessions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "prj_-jPU4p7xAmeh".auth_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_throttle; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".auth_throttle (
    key text NOT NULL,
    fails integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_appointments; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    calendar_id uuid,
    contact_id uuid,
    contact_email text NOT NULL,
    contact_name text,
    contact_phone text,
    title text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    status text DEFAULT 'confirmed'::text,
    notes text,
    source text DEFAULT 'manual'::text,
    google_event_id text,
    calendly_event_id text,
    assigned_user_id text,
    assigned_membership_id uuid,
    participant_count integer DEFAULT 1,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_appointments_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'public_link'::text, 'google'::text, 'calendly'::text]))),
    CONSTRAINT crm_appointments_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text, 'rescheduled'::text])))
);


--
-- Name: crm_availability; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    calendar_id uuid,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: crm_calendar_members; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_calendar_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    calendar_id uuid,
    user_id text NOT NULL,
    user_google_calendar_id text,
    user_outlook_calendar_id text,
    priority integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_calendars; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_calendars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'Default Calendar'::text NOT NULL,
    slug text,
    description text,
    calendar_type text DEFAULT 'personal'::text,
    owner_user_id text,
    max_participants integer DEFAULT 1,
    date_range_days integer,
    slot_duration integer DEFAULT 30,
    slot_interval integer DEFAULT 0,
    max_bookings_per_day integer,
    min_notice_hours integer DEFAULT 1,
    buffer_before integer DEFAULT 0,
    buffer_after integer DEFAULT 0,
    timezone text DEFAULT 'America/New_York'::text,
    is_active boolean DEFAULT true,
    meeting_location_type text DEFAULT 'custom'::text,
    meeting_location_value text,
    host_notify_on_booking boolean DEFAULT true,
    google_calendar_id text,
    google_refresh_token text,
    calendly_user_uri text,
    calendly_webhook_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    calendly_connection_id uuid,
    CONSTRAINT crm_calendars_calendar_type_check CHECK ((calendar_type = ANY (ARRAY['personal'::text, 'round_robin'::text, 'class'::text, 'collective'::text])))
);


--
-- Name: crm_calendly_connections; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_calendly_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    calendly_user_uri text NOT NULL,
    calendly_user_email text,
    calendly_user_name text,
    calendly_org_uri text,
    encrypted_access_token text NOT NULL,
    signing_key text NOT NULL,
    webhook_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_contact_lists; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_contact_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    list_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_contacts; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    phone text,
    sms_opt_in boolean DEFAULT false,
    address jsonb,
    source text DEFAULT 'manual'::text,
    tags text[] DEFAULT '{}'::text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    ecom_customer_id uuid,
    total_orders integer DEFAULT 0,
    total_spent integer DEFAULT 0,
    last_order_at timestamp with time zone,
    first_order_at timestamp with time zone,
    purchased_product_ids text[] DEFAULT '{}'::text[],
    purchased_product_names text[] DEFAULT '{}'::text[],
    subscribed boolean DEFAULT true,
    subscribed_at timestamp with time zone DEFAULT now(),
    unsubscribed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_events; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    campaign_id uuid,
    channel text DEFAULT 'email'::text NOT NULL,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    goal_id uuid,
    flow_id uuid,
    send_id uuid,
    event_key text,
    CONSTRAINT crm_events_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text]))),
    CONSTRAINT crm_events_event_type_check CHECK ((event_type = ANY (ARRAY['sent'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'unsubscribed'::text, 'opt_out'::text, 'delivered'::text, 'failed'::text, 'undelivered'::text, 'replied'::text, 'converted'::text])))
);


--
-- Name: crm_flow_logs; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_flow_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid,
    step_id uuid,
    contact_id uuid,
    trigger_event text NOT NULL,
    status text DEFAULT 'executed'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_flow_logs_status_check CHECK ((status = ANY (ARRAY['executed'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: crm_flow_steps; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_flow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid,
    step_order integer NOT NULL,
    action_type text NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_flow_steps_action_type_check CHECK ((action_type = ANY (ARRAY['send_email'::text, 'send_sms'::text, 'add_tag'::text, 'add_to_list'::text, 'wait'::text])))
);


--
-- Name: crm_flows; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    cron_job_name text,
    last_fired_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    goal_id uuid,
    CONSTRAINT crm_flows_trigger_type_check CHECK ((trigger_type = ANY (ARRAY[(('contact'::text || chr(46)) || 'subscribed'::text), (('order'::text || chr(46)) || 'placed'::text), (('contact'::text || chr(46)) || 'tagged'::text), (('user'::text || chr(46)) || 'registered'::text), (('appointment'::text || chr(46)) || 'booked'::text), (('schedule'::text || chr(46)) || 'cron'::text)])))
);


--
-- Name: crm_goal_actions; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_goal_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    action_type text NOT NULL,
    target_table text,
    target_id uuid,
    status text DEFAULT 'created'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_goal_contacts; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_goal_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    conversation_state text DEFAULT 'ai_active'::text NOT NULL,
    matched_at timestamp with time zone DEFAULT now(),
    last_touched_at timestamp with time zone,
    converted_at timestamp with time zone,
    conversion_reason text,
    messages_sent integer DEFAULT 0 NOT NULL,
    replies_received integer DEFAULT 0 NOT NULL,
    insights jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_goal_contacts_convstate_check CHECK ((conversation_state = ANY (ARRAY['ai_active'::text, 'paused'::text, 'human'::text]))),
    CONSTRAINT crm_goal_contacts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'converted'::text, 'exited'::text, 'suppressed'::text])))
);


--
-- Name: crm_goal_runs; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_goal_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    run_type text DEFAULT 'plan'::text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    selection_stats jsonb DEFAULT '{}'::jsonb,
    processing_stats jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    error text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_goal_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT crm_goal_runs_type_check CHECK ((run_type = ANY (ARRAY['plan'::text, 'tick'::text, 'classify'::text, 'reply'::text, 'evaluate'::text])))
);


--
-- Name: crm_goals; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    objective_text text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    category text,
    tags text[] DEFAULT '{}'::text[],
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    success_criteria jsonb DEFAULT '{}'::jsonb,
    plan jsonb DEFAULT '{}'::jsonb,
    rules jsonb DEFAULT '{}'::jsonb,
    instructions text,
    sender jsonb DEFAULT '{}'::jsonb,
    created_by text,
    last_run_at timestamp with time zone,
    last_processed_at timestamp with time zone,
    last_contact_match_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crm_goals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'planning'::text, 'needs_approval'::text, 'active'::text, 'paused'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: crm_lists; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".crm_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    filter_query jsonb,
    is_dynamic boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    goal_id uuid
);


--
-- Name: faqs; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".faqs (
    id bigint NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: faqs_id_seq; Type: SEQUENCE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".faqs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "prj_-jPU4p7xAmeh".faqs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".password_reset_tokens (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    token_hash text NOT NULL,
    scope text DEFAULT 'customer'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    CONSTRAINT password_reset_tokens_scope_check CHECK ((scope = ANY (ARRAY['customer'::text, 'admin'::text])))
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".password_reset_tokens ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "prj_-jPU4p7xAmeh".password_reset_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profiles; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'viewer'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    password_hash text,
    password_updated_at timestamp with time zone,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'dispatcher'::text, 'viewer'::text, 'customer'::text, 'pending_staff'::text])))
);


--
-- Name: rate_limits; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".rate_limits (
    key text NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".reviews (
    id bigint NOT NULL,
    author text NOT NULL,
    rating smallint DEFAULT 5 NOT NULL,
    text text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".reviews ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "prj_-jPU4p7xAmeh".reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: road_notes; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".road_notes (
    id bigint NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    category text,
    read_minutes integer,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: road_notes_id_seq; Type: SEQUENCE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".road_notes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "prj_-jPU4p7xAmeh".road_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_requests; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".service_requests (
    id bigint NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    location text NOT NULL,
    truck_details text,
    issue_description text NOT NULL,
    urgency text DEFAULT 'emergency'::text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    assigned_to uuid,
    internal_notes text,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT service_requests_status_check CHECK ((status = ANY (ARRAY['new'::text, 'dispatched'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT service_requests_urgency_check CHECK ((urgency = ANY (ARRAY['emergency'::text, 'today'::text, 'scheduled'::text])))
);


--
-- Name: service_requests_id_seq; Type: SEQUENCE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".service_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "prj_-jPU4p7xAmeh".service_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: site_content; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".site_content (
    key text NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    section text DEFAULT 'General'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT site_content_type_check CHECK ((type = ANY (ARRAY['text'::text, 'richtext'::text, 'image'::text])))
);


--
-- Name: system_settings; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".system_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh".user_roles (
    user_id uuid NOT NULL,
    role text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_by uuid,
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'dispatcher'::text, 'viewer'::text, 'customer'::text])))
);


--
-- Name: identities; Type: TABLE; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh_auth".identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    provider text NOT NULL,
    identity_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh_auth".users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    encrypted_password text,
    email_confirmed_at timestamp with time zone,
    phone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    is_anonymous boolean DEFAULT false,
    phone_confirmed_at timestamp with time zone,
    confirmation_token text,
    confirmation_sent_at timestamp with time zone,
    recovery_token text,
    recovery_sent_at timestamp with time zone
);


--
-- Name: buckets; Type: TABLE; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh_storage".buckets (
    id text NOT NULL,
    name text NOT NULL,
    public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    file_size_limit bigint,
    allowed_mime_types text[]
);


--
-- Name: objects; Type: TABLE; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE TABLE "prj_-jPU4p7xAmeh_storage".objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    path_tokens text[],
    version text
);


--
-- Data for Name: admin_allowlist; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".admin_allowlist (email, note, added_at) FROM stdin;
uminder1313@gmail.com	Bootstrap owner administrator - first entry	2026-09-18 19:08:26.395912+00
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".audit_log (id, actor_id, actor_email, action, entity, entity_id, metadata, created_at) FROM stdin;
1	\N	\N	insert.reviews	reviews	1	{"new": {"id": 1, "text": "Blew a tire outside Grand Falls at 2am. They were there in forty minutes.", "author": "Owner-operator · Edmundston", "rating": 5, "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": true}}	2026-09-18 16:35:55.967725+00
2	\N	\N	insert.reviews	reviews	2	{"new": {"id": 2, "text": "Our whole fleet gets serviced in our yard now. Zero downtime.", "author": "Fleet manager · Grand Falls", "rating": 5, "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 2, "is_published": true}}	2026-09-18 16:35:55.967725+00
3	\N	\N	insert.reviews	reviews	3	{"new": {"id": 3, "text": "Reefer died in −28. Fixed on the shoulder, load saved.", "author": "Long-haul driver · Hwy 2", "rating": 5, "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 3, "is_published": true}}	2026-09-18 16:35:55.967725+00
4	\N	\N	insert.road_notes	road_notes	1	{"new": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": true, "published_at": "2026-09-18T16:35:55.967725+00:00", "read_minutes": 6}}	2026-09-18 16:35:55.967725+00
5	\N	\N	insert.road_notes	road_notes	2	{"new": {"id": 2, "body": "", "title": "Cold-start checklist for the first −20° night.", "category": "Battery", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 2, "is_published": true, "published_at": "2026-09-18T16:35:55.967725+00:00", "read_minutes": 4}}	2026-09-18 16:35:55.967725+00
6	\N	\N	insert.road_notes	road_notes	3	{"new": {"id": 3, "body": "", "title": "Three sounds your reefer makes before it fails.", "category": "Reefer", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 3, "is_published": true, "published_at": "2026-09-18T16:35:55.967725+00:00", "read_minutes": 5}}	2026-09-18 16:35:55.967725+00
7	\N	\N	insert.faqs	faqs	1	{"new": {"id": 1, "answer": "Dispatch answers 24/7 and a mechanic is usually rolling within 30 minutes of your call. Average arrival along the Highway 2 corridor is about 45 minutes, and you get a live ETA by text as soon as the truck leaves. If we are further out than that, you hear the real number on the phone instead of a guess.", "question": "How fast do you actually arrive?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": true}}	2026-09-18 16:35:55.967725+00
8	\N	\N	insert.faqs	faqs	2	{"new": {"id": 2, "answer": "The Saint John River valley and the Trans-Canada Highway 2 corridor: Edmundston, Grand Falls, Saint-Léonard, Saint-Quentin and everything in between — roadside or in your yard. Sitting just outside that stretch? Call anyway and we will tell you straight away whether we can reach you.", "question": "What areas do you cover?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 2, "is_published": true}}	2026-09-18 16:35:55.967725+00
9	\N	\N	insert.faqs	faqs	3	{"new": {"id": 3, "answer": "Yes — winter is our busiest season. Our service trucks carry lighting, heat and cold-weather gear, so −30, freezing rain and snowbanks are normal working conditions, not a reason TO wait until morning. We also run cold-weather readiness checks every fall so fewer trucks need that 3am call.", "question": "Do you come out in winter conditions?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 3, "is_published": true}}	2026-09-18 16:35:55.967725+00
10	\N	\N	insert.faqs	faqs	4	{"new": {"id": 4, "answer": "Payment is settled on site once the truck is moving again, and you get an itemised digital invoice covering labour and parts. [Add the payment methods you accept.] Fleet accounts are handled separately — see below.", "question": "What payment methods do you accept?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 4, "is_published": true}}	2026-09-18 16:35:55.967725+00
11	\N	\N	insert.faqs	faqs	5	{"new": {"id": 5, "answer": "Yes — reefer calls run on the same 24/7 dispatch as everything else. A dead refrigeration unit is a load on a clock, so those calls are treated as emergencies: we diagnose on the shoulder or in your yard and get the box back down TO temperature before the freight is written off.", "question": "Do you service reefers after hours?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 5, "is_published": true}}	2026-09-18 16:35:55.967725+00
12	\N	\N	insert.faqs	faqs	6	{"new": {"id": 6, "answer": "Fleets from 3 to 300 trucks run on a single account: one phone number, one invoice covering every unit, and full digital service records per truck so your compliance file stays current. [Add your fleet billing terms.]", "question": "How are fleet accounts billed?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 6, "is_published": true}}	2026-09-18 16:35:55.967725+00
13	\N	\N	insert.faqs	faqs	7	{"new": {"id": 7, "answer": "Most calls end with the truck driving away. When a repair genuinely needs a shop — a major engine or transmission failure — we tell you on the spot instead of billing hours against a job that cannot finish, and we help arrange the tow and hand over the diagnosis so nobody starts from scratch.", "question": "What if the repair cannot be done roadside?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 7, "is_published": true}}	2026-09-18 16:35:55.967725+00
14	\N	\N	insert.faqs	faqs	8	{"new": {"id": 8, "answer": "Our service trucks are stocked for the failures we see most: filters, belts, hoses, air line fittings, lamps, batteries and tire service. Anything we do not carry, we source and bring out — you are not phoning parts counters from the shoulder of the highway.", "question": "Do your trucks carry parts?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 8, "is_published": true}}	2026-09-18 16:35:55.967725+00
34	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_cta_secondary", "type": "text", "label": "Secondary button label", "value": "How it works", "section": "Hero", "sort_order": 60, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
35	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_platform_label", "type": "text", "label": "Caption under the hero art", "value": "Dispatched from Edmundston", "section": "Hero", "sort_order": 70, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
36	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "services_title", "type": "text", "label": "Section title", "value": "What we fix.", "section": "Services", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
37	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "services_sub", "type": "text", "label": "Section intro", "value": "Almost everything that stops a truck.", "section": "Services", "sort_order": 20, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
128	\N	\N	user.role_granted	user_roles	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	{"role": "customer", "target_email": "tmp-reset-1789760186725@example.com"}	2026-09-18 19:36:27.196778+00
21	\N	\N	update.faqs	faqs	4	{"new": {"id": 4, "answer": "Payment is settled on site once the truck is moving again, and you get an itemised digital invoice by email covering labour and parts. Roadside we take debit and all major credit cards on the mechanic’s card reader, plus Interac e-Transfer and cash — nobody has to go hunting for a bank machine at 3am. Company cheques are accepted from established account holders. Fleet accounts are handled separately — see below.", "question": "What payment methods do you accept?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 4, "is_published": true}, "old": {"id": 4, "answer": "Payment is settled on site once the truck is moving again, and you get an itemised digital invoice covering labour and parts. [Add the payment methods you accept.] Fleet accounts are handled separately — see below.", "question": "What payment methods do you accept?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 4, "is_published": true}}	2026-09-18 17:06:45.248504+00
22	\N	\N	update.faqs	faqs	6	{"new": {"id": 6, "answer": "Fleets from 3 to 300 trucks run on a single account: one phone number, one invoice covering every unit, and full digital service records per truck so your compliance file stays current. Approved accounts skip roadside payment and are invoiced once a month instead — every call on one statement, itemised by unit and work order, payable within 30 days by e-Transfer, cheque or card. We can quote your purchase-order number on the invoice, and the account is opened over the phone before the first call so there is no paperwork at 2am.", "question": "How are fleet accounts billed?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 6, "is_published": true}, "old": {"id": 6, "answer": "Fleets from 3 to 300 trucks run on a single account: one phone number, one invoice covering every unit, and full digital service records per truck so your compliance file stays current. [Add your fleet billing terms.]", "question": "How are fleet accounts billed?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 6, "is_published": true}}	2026-09-18 17:06:45.311996+00
23	\N	\N	update.faqs	faqs	3	{"new": {"id": 3, "answer": "Yes — winter is our busiest season. Our service trucks carry lighting, heat and cold-weather gear, so −30, freezing rain and snowbanks are normal working conditions, not a reason to wait until morning. We also run cold-weather readiness checks every fall so fewer trucks need that 3am call.", "question": "Do you come out in winter conditions?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 3, "is_published": true}, "old": {"id": 3, "answer": "Yes — winter is our busiest season. Our service trucks carry lighting, heat and cold-weather gear, so −30, freezing rain and snowbanks are normal working conditions, not a reason TO wait until morning. We also run cold-weather readiness checks every fall so fewer trucks need that 3am call.", "question": "Do you come out in winter conditions?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 3, "is_published": true}}	2026-09-18 17:06:45.405011+00
24	\N	\N	update.faqs	faqs	5	{"new": {"id": 5, "answer": "Yes — reefer calls run on the same 24/7 dispatch as everything else. A dead refrigeration unit is a load on a clock, so those calls are treated as emergencies: we diagnose on the shoulder or in your yard and get the box back down to temperature before the freight is written off.", "question": "Do you service reefers after hours?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 5, "is_published": true}, "old": {"id": 5, "answer": "Yes — reefer calls run on the same 24/7 dispatch as everything else. A dead refrigeration unit is a load on a clock, so those calls are treated as emergencies: we diagnose on the shoulder or in your yard and get the box back down TO temperature before the freight is written off.", "question": "Do you service reefers after hours?", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 5, "is_published": true}}	2026-09-18 17:06:45.456559+00
25	\N	\N	auth.login_failed	auth	\N	{"locked": false}	2026-09-18 17:18:46.616075+00
26	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.registered	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "customer"}	2026-09-18 17:47:38.290753+00
27	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "customer"}	2026-09-18 17:48:03.92683+00
28	\N	\N	auth.login_failed	auth	\N	{"locked": false}	2026-09-18 18:14:07.835757+00
29	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_eyebrow", "type": "text", "label": "Hero eyebrow", "value": "// 24/7 · Northern New Brunswick", "section": "Hero", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
30	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_line1", "type": "text", "label": "Headline — line 1", "value": "Truck trouble doesn't wait.", "section": "Hero", "sort_order": 20, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
31	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_line2", "type": "text", "label": "Headline — line 2 (amber)", "value": "Neither do we.", "section": "Hero", "sort_order": 30, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
32	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_sub", "type": "richtext", "label": "Sub-headline", "value": "24/7 mobile heavy-duty truck & trailer repair. Certified mechanics dispatched TO your location — no tow, no shop wait.", "section": "Hero", "sort_order": 40, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
33	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_cta_primary", "type": "text", "label": "Primary button label", "value": "Call BTown now", "section": "Hero", "sort_order": 50, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
93	1f70d031-4ade-4574-8d63-140096f641c0	authtest-stranger@example.com	auth.admin_registered	profiles	1f70d031-4ade-4574-8d63-140096f641c0	{"door": "staff", "role": "pending_staff", "first_admin_bootstrap": false}	2026-09-18 19:09:41.841598+00
95	\N	\N	delete.profiles	profiles	4d8249e5-0a14-4ba3-a3bc-57ffd0f80021	{"old": {"id": "4d8249e5-0a14-4ba3-a3bc-57ffd0f80021", "role": "admin", "email": "authtest-owner@example.com", "full_name": "Smoke Test Owner", "is_active": true, "created_at": "2026-09-18T19:09:41.052578+00:00"}}	2026-09-18 19:10:39.597209+00
96	\N	\N	delete.profiles	profiles	1f70d031-4ade-4574-8d63-140096f641c0	{"old": {"id": "1f70d031-4ade-4574-8d63-140096f641c0", "role": "pending_staff", "email": "authtest-stranger@example.com", "full_name": "Smoke Test Stranger", "is_active": true, "created_at": "2026-09-18T19:09:41.678436+00:00"}}	2026-09-18 19:10:39.597209+00
131	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	tmp-reset-1789760186725@example.com	auth.registered	profiles	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	{"v": 3, "door": "customer", "role": "customer", "roles": ["customer"]}	2026-09-18 19:36:27.752594+00
133	\N	\N	auth.reset_requested	password_reset_tokens	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	{"scope": "customer", "channel": "email"}	2026-09-18 19:36:29.427727+00
38	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_engine_title", "type": "text", "label": "Card 1 — title", "value": "Engine", "section": "Services", "sort_order": 30, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
39	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_engine_desc", "type": "text", "label": "Card 1 — description", "value": "Mobile truck & trailer repair", "section": "Services", "sort_order": 31, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
40	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_diesel_title", "type": "text", "label": "Card 2 — title", "value": "Diesel", "section": "Services", "sort_order": 40, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
41	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_diesel_desc", "type": "text", "label": "Card 2 — description", "value": "Diagnostics & fuel systems", "section": "Services", "sort_order": 41, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
42	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_tire_title", "type": "text", "label": "Card 3 — title", "value": "Tires", "section": "Services", "sort_order": 50, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
43	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_tire_desc", "type": "text", "label": "Card 3 — description", "value": "Roadside tire service", "section": "Services", "sort_order": 51, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
44	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_battery_title", "type": "text", "label": "Card 4 — title", "value": "Battery", "section": "Services", "sort_order": 60, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
45	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_battery_desc", "type": "text", "label": "Card 4 — description", "value": "Jump start & cold-start", "section": "Services", "sort_order": 61, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
46	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_brakes_title", "type": "text", "label": "Card 5 — title", "value": "Brakes", "section": "Services", "sort_order": 70, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
47	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_brakes_desc", "type": "text", "label": "Card 5 — description", "value": "Brakes & air systems", "section": "Services", "sort_order": 71, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
48	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_reefer_title", "type": "text", "label": "Card 6 — title", "value": "Reefer", "section": "Services", "sort_order": 80, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
49	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_reefer_desc", "type": "text", "label": "Card 6 — description", "value": "Refrigeration units", "section": "Services", "sort_order": 81, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
50	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_trailer_title", "type": "text", "label": "Card 7 — title", "value": "Trailer", "section": "Services", "sort_order": 90, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
51	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_trailer_desc", "type": "text", "label": "Card 7 — description", "value": "Trailer repair", "section": "Services", "sort_order": 91, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
52	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_fleet_title", "type": "text", "label": "Card 8 — title", "value": "Fleet", "section": "Services", "sort_order": 100, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
53	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "service_fleet_desc", "type": "text", "label": "Card 8 — description", "value": "Scheduled maintenance", "section": "Services", "sort_order": 101, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
54	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_title", "type": "text", "label": "Section title", "value": "Three steps.", "section": "How it works", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
55	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_sub", "type": "text", "label": "Section intro", "value": "From the shoulder of the highway TO back on the road.", "section": "How it works", "sort_order": 20, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
56	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_step1_label", "type": "text", "label": "Step 1 — label", "value": "Call", "section": "How it works", "sort_order": 30, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
57	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_step1_line", "type": "text", "label": "Step 1 — description", "value": "Tell us where you are and what’s wrong", "section": "How it works", "sort_order": 31, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
58	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_step2_label", "type": "text", "label": "Step 2 — label", "value": "We roll", "section": "How it works", "sort_order": 40, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
59	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_step2_line", "type": "text", "label": "Step 2 — description", "value": "A certified mechanic is dispatched; you get an ETA by text", "section": "How it works", "sort_order": 41, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
60	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_step3_label", "type": "text", "label": "Step 3 — label", "value": "Fixed", "section": "How it works", "sort_order": 50, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
61	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "how_step3_line", "type": "text", "label": "Step 3 — description", "value": "Repaired roadside or in your yard — you’re moving again", "section": "How it works", "sort_order": 51, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
94	\N	\N	auth.login_failed	auth	\N	{"locked": false}	2026-09-18 19:09:45.777967+00
62	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "fleets_title", "type": "text", "label": "Section title", "value": "Parked trucks earn nothing.", "section": "Fleets", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
63	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "fleets_body", "type": "richtext", "label": "Section body", "value": "Scheduled on-site maintenance and priority dispatch for fleets of 3 to 300 — one number, one invoice, full digital service records.", "section": "Fleets", "sort_order": 20, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
64	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "fleets_cta", "type": "text", "label": "Button label", "value": "Book a fleet visit", "section": "Fleets", "sort_order": 30, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
65	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "fleets_caption", "type": "text", "label": "Caption under the yard illustration", "value": "Yard service · Edmundston TO Saint-Quentin", "section": "Fleets", "sort_order": 40, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
66	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "coverage_title", "type": "text", "label": "Section title", "value": "Northern NB, covered.", "section": "Coverage", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
67	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "coverage_body", "type": "richtext", "label": "Section body", "value": "Dispatched across the Saint John River valley and the Trans-Canada Highway 2 corridor.", "section": "Coverage", "sort_order": 20, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
68	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "coverage_towns", "type": "text", "label": "Town list (comma separated)", "value": "Edmundston, Grand Falls, Saint-Léonard, Saint-Quentin, Hwy 2", "section": "Coverage", "sort_order": 30, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
69	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "coverage_cta", "type": "text", "label": "Button label", "value": "Check my location", "section": "Coverage", "sort_order": 40, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
70	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "contact_title", "type": "text", "label": "Section title", "value": "Need us now?", "section": "Contact", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
71	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "contact_body", "type": "richtext", "label": "Section body", "value": "Same number, day or night.", "section": "Contact", "sort_order": 20, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
72	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "contact_phone", "type": "text", "label": "24/7 phone number (used everywhere on the site)", "value": "506-223-1121", "section": "Contact", "sort_order": 30, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
73	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "contact_email", "type": "text", "label": "Business email — shown in the contact section only when filled in", "value": "", "section": "Contact", "sort_order": 40, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
74	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "contact_service_area", "type": "text", "label": "Service area line", "value": "Edmundston · Grand Falls · Saint-Léonard · Saint-Quentin · Hwy 2", "section": "Contact", "sort_order": 50, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
75	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "footer_tagline", "type": "richtext", "label": "Footer tagline", "value": "24/7 mobile heavy-duty truck & trailer repair across Northern New Brunswick.", "section": "Footer", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
76	\N	\N	insert.site_content	site_content	\N	{"new": {"key": "hero_image", "type": "image", "label": "Hero image — replaces the built-in truck illustration when set", "value": "", "section": "Images", "sort_order": 10, "updated_at": "2026-09-18T18:16:32.453885+00:00", "updated_by": null}}	2026-09-18 18:16:32.453885+00
77	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "customer"}	2026-09-18 18:30:47.358733+00
78	dc617bca-d352-4e4a-9910-7e799ed3c073	kamal1313@gmail.com	auth.staff_registered	profiles	dc617bca-d352-4e4a-9910-7e799ed3c073	{"door": "staff", "role": "pending_staff"}	2026-09-18 18:49:11.502701+00
79	\N	\N	auth.login_failed	auth	\N	{"locked": false}	2026-09-18 18:51:36.513139+00
80	\N	\N	auth.login_failed	auth	\N	{"locked": false}	2026-09-18 18:51:38.975934+00
81	\N	\N	auth.login_failed	auth	\N	{"locked": false}	2026-09-18 18:51:40.965287+00
82	12512035-8758-4ab9-9c08-0c561b0e2066	admin@gmail.com	auth.staff_registered	profiles	12512035-8758-4ab9-9c08-0c561b0e2066	{"door": "staff", "role": "pending_staff"}	2026-09-18 18:53:23.217159+00
83	\N	\N	auth.login_failed	auth	\N	{"locked": false}	2026-09-18 18:59:16.636161+00
84	cf3ece7e-25e4-414d-8f85-2fa623fdd424	testadmin@gmail.com	auth.admin_registered	profiles	cf3ece7e-25e4-414d-8f85-2fa623fdd424	{"door": "staff", "role": "pending_staff", "first_admin_bootstrap": false}	2026-09-18 19:04:38.59499+00
85	\N	\N	auth.reset_requested	auth	\N	{}	2026-09-18 19:07:04.513037+00
86	\N	\N	update.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"new": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00"}, "old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "customer", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00"}}	2026-09-18 19:08:35.584483+00
87	\N	\N	auth.reset_requested	auth	\N	{}	2026-09-18 19:08:38.498362+00
88	\N	\N	delete.profiles	profiles	4530a1b3-558d-411d-a915-51318a723019	{"old": {"id": "4530a1b3-558d-411d-a915-51318a723019", "role": "admin", "email": "authtest-owner@example.com", "full_name": "Smoke Test Owner", "is_active": true, "created_at": "2026-09-18T19:09:34.040096+00:00"}}	2026-09-18 19:09:34.289135+00
89	\N	\N	delete.profiles	profiles	5038017a-aa53-4e40-8e78-050c3db817ff	{"old": {"id": "5038017a-aa53-4e40-8e78-050c3db817ff", "role": "customer", "email": "authtest-stranger@example.com", "full_name": "Smoke Test Stranger", "is_active": true, "created_at": "2026-09-18T19:09:34.701455+00:00"}}	2026-09-18 19:09:34.866796+00
91	4d8249e5-0a14-4ba3-a3bc-57ffd0f80021	authtest-owner@example.com	auth.admin_registered	profiles	4d8249e5-0a14-4ba3-a3bc-57ffd0f80021	{"door": "staff", "role": "admin", "first_admin_bootstrap": false}	2026-09-18 19:09:41.239158+00
90	\N	\N	update.profiles	profiles	4d8249e5-0a14-4ba3-a3bc-57ffd0f80021	{"new": {"id": "4d8249e5-0a14-4ba3-a3bc-57ffd0f80021", "role": "admin", "email": "authtest-owner@example.com", "full_name": "Smoke Test Owner", "is_active": true, "created_at": "2026-09-18T19:09:41.052578+00:00"}, "old": {"id": "4d8249e5-0a14-4ba3-a3bc-57ffd0f80021", "role": "admin", "email": "authtest-owner@example.com", "full_name": "Smoke Test Owner", "is_active": true, "created_at": "2026-09-18T19:09:41.052578+00:00"}}	2026-09-18 19:09:41.122974+00
92	\N	\N	update.profiles	profiles	1f70d031-4ade-4574-8d63-140096f641c0	{"new": {"id": "1f70d031-4ade-4574-8d63-140096f641c0", "role": "pending_staff", "email": "authtest-stranger@example.com", "full_name": "Smoke Test Stranger", "is_active": true, "created_at": "2026-09-18T19:09:41.678436+00:00"}, "old": {"id": "1f70d031-4ade-4574-8d63-140096f641c0", "role": "pending_staff", "email": "authtest-stranger@example.com", "full_name": "Smoke Test Stranger", "is_active": true, "created_at": "2026-09-18T19:09:41.678436+00:00"}}	2026-09-18 19:09:41.718232+00
97	\N	\N	auth.reset_requested	auth	\N	{}	2026-09-18 19:13:02.427475+00
98	\N	\N	update.profiles	profiles	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	{"new": {"id": "3dd0ff80-5852-40b9-b7bb-2021e88b44ea", "role": "customer", "email": "alex@gmail.com", "full_name": "Alex", "is_active": true, "created_at": "2026-09-18T19:16:37.726304+00:00"}, "old": {"id": "3dd0ff80-5852-40b9-b7bb-2021e88b44ea", "role": "customer", "email": "alex@gmail.com", "full_name": "Alex", "is_active": true, "created_at": "2026-09-18T19:16:37.726304+00:00"}}	2026-09-18 19:16:37.771934+00
99	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	alex@gmail.com	auth.registered	profiles	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	{"door": "customer", "role": "customer", "first_admin_bootstrap": false}	2026-09-18 19:16:37.904783+00
100	\N	\N	update.profiles	profiles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"new": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:23.091148+00:00"}, "old": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:23.091148+00:00"}}	2026-09-18 19:23:23.154796+00
101	cdc14cf6-90f6-4b86-8389-da3e0a06266f	verify.probe.one@example.com	auth.registered	profiles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"door": "customer", "role": "customer", "first_admin_bootstrap": false}	2026-09-18 19:23:23.410494+00
102	\N	\N	user.role_granted	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:27:38.567155+00
103	\N	\N	update.profiles	profiles	932a2a90-2f85-43a0-9949-2dc879500c62	{"new": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.567155+00:00"}, "old": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.567155+00:00"}}	2026-09-18 19:27:38.624712+00
104	932a2a90-2f85-43a0-9949-2dc879500c62	verify.probe.four.b7d2@example.com	auth.registered	profiles	932a2a90-2f85-43a0-9949-2dc879500c62	{"door": "customer", "role": "customer", "first_admin_bootstrap": false}	2026-09-18 19:27:38.812071+00
105	\N	lex@gmail.com	auth.login_failed	auth	\N	{"v": 3, "locked": false, "reason": "invalid_grant"}	2026-09-18 19:28:53.529636+00
106	\N	\N	user.role_granted	user_roles	43e5deef-b09b-4117-b5aa-7caac1b95b38	{"role": "customer", "target_email": "tmp-a-1789760135026@example.com"}	2026-09-18 19:35:35.506431+00
107	\N	\N	update.profiles	profiles	43e5deef-b09b-4117-b5aa-7caac1b95b38	{"new": {"id": "43e5deef-b09b-4117-b5aa-7caac1b95b38", "role": "customer", "email": "tmp-a-1789760135026@example.com", "full_name": "Temp A", "is_active": true, "created_at": "2026-09-18T19:35:35.506431+00:00"}, "old": {"id": "43e5deef-b09b-4117-b5aa-7caac1b95b38", "role": "customer", "email": "tmp-a-1789760135026@example.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:35:35.506431+00:00"}}	2026-09-18 19:35:35.952995+00
108	\N	\N	user.role_removed	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:35:36.034794+00
109	\N	\N	user.role_removed	user_roles	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	{"role": "customer", "target_email": "alex@gmail.com"}	2026-09-18 19:35:36.034794+00
110	\N	\N	user.role_removed	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:35:36.034794+00
111	\N	\N	user.role_removed	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "customer", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:35:36.034794+00
112	\N	\N	user.role_removed	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:35:36.034794+00
113	\N	\N	user.role_removed	user_roles	43e5deef-b09b-4117-b5aa-7caac1b95b38	{"role": "customer", "target_email": "tmp-a-1789760135026@example.com"}	2026-09-18 19:35:36.034794+00
114	43e5deef-b09b-4117-b5aa-7caac1b95b38	tmp-a-1789760135026@example.com	auth.registered	profiles	43e5deef-b09b-4117-b5aa-7caac1b95b38	{"v": 3, "door": "customer", "role": "customer", "roles": []}	2026-09-18 19:35:36.246918+00
115	\N	\N	user.role_granted	user_roles	e5badf04-65bb-4bdb-b16a-0ce03ec79e7a	{"role": "customer", "target_email": "tmp-b-1789760135026@example.com"}	2026-09-18 19:35:37.099864+00
116	\N	\N	update.profiles	profiles	e5badf04-65bb-4bdb-b16a-0ce03ec79e7a	{"new": {"id": "e5badf04-65bb-4bdb-b16a-0ce03ec79e7a", "role": "pending_staff", "email": "tmp-b-1789760135026@example.com", "full_name": "Temp B", "is_active": true, "created_at": "2026-09-18T19:35:37.099864+00:00"}, "old": {"id": "e5badf04-65bb-4bdb-b16a-0ce03ec79e7a", "role": "customer", "email": "tmp-b-1789760135026@example.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:35:37.099864+00:00"}}	2026-09-18 19:35:37.400547+00
117	\N	\N	user.role_removed	user_roles	e5badf04-65bb-4bdb-b16a-0ce03ec79e7a	{"role": "customer", "target_email": "tmp-b-1789760135026@example.com"}	2026-09-18 19:35:37.487721+00
118	e5badf04-65bb-4bdb-b16a-0ce03ec79e7a	tmp-b-1789760135026@example.com	auth.admin_registered	profiles	e5badf04-65bb-4bdb-b16a-0ce03ec79e7a	{"v": 3, "door": "staff", "role": "pending_staff", "roles": []}	2026-09-18 19:35:37.677491+00
119	\N	\N	delete.profiles	profiles	dc617bca-d352-4e4a-9910-7e799ed3c073	{"old": {"id": "dc617bca-d352-4e4a-9910-7e799ed3c073", "role": "pending_staff", "email": "kamal1313@gmail.com", "full_name": "Kamal Anand", "is_active": true, "created_at": "2026-09-18T18:49:11.158681+00:00"}}	2026-09-18 19:35:39.411288+00
120	\N	\N	delete.profiles	profiles	12512035-8758-4ab9-9c08-0c561b0e2066	{"old": {"id": "12512035-8758-4ab9-9c08-0c561b0e2066", "role": "pending_staff", "email": "admin@gmail.com", "full_name": "Admin_test", "is_active": true, "created_at": "2026-09-18T18:53:23.054373+00:00"}}	2026-09-18 19:35:39.411288+00
121	\N	\N	delete.profiles	profiles	cf3ece7e-25e4-414d-8f85-2fa623fdd424	{"old": {"id": "cf3ece7e-25e4-414d-8f85-2fa623fdd424", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "Testadmin", "is_active": true, "created_at": "2026-09-18T19:04:38.453929+00:00"}}	2026-09-18 19:35:39.411288+00
122	\N	\N	delete.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00"}}	2026-09-18 19:35:39.411288+00
123	\N	\N	delete.profiles	profiles	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	{"old": {"id": "3dd0ff80-5852-40b9-b7bb-2021e88b44ea", "role": "customer", "email": "alex@gmail.com", "full_name": "Alex", "is_active": true, "created_at": "2026-09-18T19:16:37.726304+00:00"}}	2026-09-18 19:35:39.411288+00
124	\N	\N	delete.profiles	profiles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"old": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:23.091148+00:00"}}	2026-09-18 19:35:39.411288+00
125	\N	\N	delete.profiles	profiles	932a2a90-2f85-43a0-9949-2dc879500c62	{"old": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.567155+00:00"}}	2026-09-18 19:35:39.411288+00
126	\N	\N	delete.profiles	profiles	43e5deef-b09b-4117-b5aa-7caac1b95b38	{"old": {"id": "43e5deef-b09b-4117-b5aa-7caac1b95b38", "role": "customer", "email": "tmp-a-1789760135026@example.com", "full_name": "Temp A", "is_active": true, "created_at": "2026-09-18T19:35:35.506431+00:00"}}	2026-09-18 19:35:39.411288+00
127	\N	\N	delete.profiles	profiles	e5badf04-65bb-4bdb-b16a-0ce03ec79e7a	{"old": {"id": "e5badf04-65bb-4bdb-b16a-0ce03ec79e7a", "role": "pending_staff", "email": "tmp-b-1789760135026@example.com", "full_name": "Temp B", "is_active": true, "created_at": "2026-09-18T19:35:37.099864+00:00"}}	2026-09-18 19:35:39.411288+00
129	\N	\N	update.profiles	profiles	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	{"new": {"id": "67d29c4c-f0ed-409c-99f7-7871bcd5a1d8", "role": "customer", "email": "tmp-reset-1789760186725@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:27.196778+00:00"}, "old": {"id": "67d29c4c-f0ed-409c-99f7-7871bcd5a1d8", "role": "customer", "email": "tmp-reset-1789760186725@example.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:36:27.196778+00:00"}}	2026-09-18 19:36:27.465871+00
130	\N	\N	update.profiles	profiles	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	{"new": {"id": "67d29c4c-f0ed-409c-99f7-7871bcd5a1d8", "role": "customer", "email": "tmp-reset-1789760186725@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:27.196778+00:00"}, "old": {"id": "67d29c4c-f0ed-409c-99f7-7871bcd5a1d8", "role": "customer", "email": "tmp-reset-1789760186725@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:27.196778+00:00"}}	2026-09-18 19:36:27.582918+00
132	\N	\N	auth.reset_failed	password_reset_tokens	1	{"reason": "expired"}	2026-09-18 19:36:28.837537+00
135	\N	\N	delete.profiles	profiles	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	{"old": {"id": "67d29c4c-f0ed-409c-99f7-7871bcd5a1d8", "role": "customer", "email": "tmp-reset-1789760186725@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:27.196778+00:00"}}	2026-09-18 19:36:29.68138+00
137	\N	\N	update.profiles	profiles	40276c52-82ed-4c57-88d0-72fd1dca2e1c	{"new": {"id": "40276c52-82ed-4c57-88d0-72fd1dca2e1c", "role": "customer", "email": "tmp-role-1789760190005@example.com", "full_name": "Role Probe", "is_active": true, "created_at": "2026-09-18T19:36:30.305294+00:00"}, "old": {"id": "40276c52-82ed-4c57-88d0-72fd1dca2e1c", "role": "customer", "email": "tmp-role-1789760190005@example.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:36:30.305294+00:00"}}	2026-09-18 19:36:30.605332+00
138	\N	\N	update.profiles	profiles	40276c52-82ed-4c57-88d0-72fd1dca2e1c	{"new": {"id": "40276c52-82ed-4c57-88d0-72fd1dca2e1c", "role": "customer", "email": "tmp-role-1789760190005@example.com", "full_name": "Role Probe", "is_active": true, "created_at": "2026-09-18T19:36:30.305294+00:00"}, "old": {"id": "40276c52-82ed-4c57-88d0-72fd1dca2e1c", "role": "customer", "email": "tmp-role-1789760190005@example.com", "full_name": "Role Probe", "is_active": true, "created_at": "2026-09-18T19:36:30.305294+00:00"}}	2026-09-18 19:36:30.739463+00
134	\N	\N	user.role_removed	user_roles	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	{"role": "customer", "target_email": "tmp-reset-1789760186725@example.com"}	2026-09-18 19:36:29.6447+00
136	\N	\N	user.role_granted	user_roles	40276c52-82ed-4c57-88d0-72fd1dca2e1c	{"role": "customer", "target_email": "tmp-role-1789760190005@example.com"}	2026-09-18 19:36:30.305294+00
141	\N	\N	delete.profiles	profiles	40276c52-82ed-4c57-88d0-72fd1dca2e1c	{"old": {"id": "40276c52-82ed-4c57-88d0-72fd1dca2e1c", "role": "customer", "email": "tmp-role-1789760190005@example.com", "full_name": "Role Probe", "is_active": true, "created_at": "2026-09-18T19:36:30.305294+00:00"}}	2026-09-18 19:36:31.501584+00
139	40276c52-82ed-4c57-88d0-72fd1dca2e1c	tmp-role-1789760190005@example.com	auth.registered	profiles	40276c52-82ed-4c57-88d0-72fd1dca2e1c	{"v": 3, "door": "customer", "role": "customer", "roles": ["customer"]}	2026-09-18 19:36:30.895857+00
140	\N	\N	user.role_removed	user_roles	40276c52-82ed-4c57-88d0-72fd1dca2e1c	{"role": "customer", "target_email": "tmp-role-1789760190005@example.com"}	2026-09-18 19:36:31.466311+00
142	\N	\N	user.role_granted	user_roles	c776afe6-9704-4418-b4ea-338a68f7a0b9	{"role": "customer", "target_email": "tmp-reset-1789760209802@example.com"}	2026-09-18 19:36:50.419361+00
143	\N	\N	update.profiles	profiles	c776afe6-9704-4418-b4ea-338a68f7a0b9	{"new": {"id": "c776afe6-9704-4418-b4ea-338a68f7a0b9", "role": "customer", "email": "tmp-reset-1789760209802@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:50.419361+00:00"}, "old": {"id": "c776afe6-9704-4418-b4ea-338a68f7a0b9", "role": "customer", "email": "tmp-reset-1789760209802@example.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:36:50.419361+00:00"}}	2026-09-18 19:36:50.640436+00
144	\N	\N	update.profiles	profiles	c776afe6-9704-4418-b4ea-338a68f7a0b9	{"new": {"id": "c776afe6-9704-4418-b4ea-338a68f7a0b9", "role": "customer", "email": "tmp-reset-1789760209802@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:50.419361+00:00"}, "old": {"id": "c776afe6-9704-4418-b4ea-338a68f7a0b9", "role": "customer", "email": "tmp-reset-1789760209802@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:50.419361+00:00"}}	2026-09-18 19:36:50.738448+00
145	c776afe6-9704-4418-b4ea-338a68f7a0b9	tmp-reset-1789760209802@example.com	auth.registered	profiles	c776afe6-9704-4418-b4ea-338a68f7a0b9	{"v": 3, "door": "customer", "role": "customer", "roles": ["customer"]}	2026-09-18 19:36:50.895823+00
146	\N	\N	auth.reset_failed	password_reset_tokens	\N	{"reason": "unknown_token"}	2026-09-18 19:36:51.82945+00
147	\N	\N	user.role_removed	user_roles	c776afe6-9704-4418-b4ea-338a68f7a0b9	{"role": "customer", "target_email": "tmp-reset-1789760209802@example.com"}	2026-09-18 19:36:52.445474+00
148	\N	\N	delete.profiles	profiles	c776afe6-9704-4418-b4ea-338a68f7a0b9	{"old": {"id": "c776afe6-9704-4418-b4ea-338a68f7a0b9", "role": "customer", "email": "tmp-reset-1789760209802@example.com", "full_name": "Reset Probe", "is_active": true, "created_at": "2026-09-18T19:36:50.419361+00:00"}}	2026-09-18 19:36:52.486836+00
149	\N	\N	user.role_granted	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:38:09.641497+00
150	\N	\N	user.role_granted	user_roles	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	{"role": "customer", "target_email": "alex@gmail.com"}	2026-09-18 19:38:09.641497+00
151	\N	\N	user.role_granted	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:38:09.641497+00
152	\N	\N	user.role_granted	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:38:09.641497+00
153	\N	\N	user.role_granted	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "customer", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:38:09.641497+00
154	\N	\N	user.role_granted	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 19:39:45.442046+00
155	\N	uminder1313@gmail.com	auth.login_failed	auth	\N	{"v": 3, "locked": false, "reason": "invalid_grant"}	2026-09-18 19:40:49.614019+00
156	\N	uminder1313@gmail.com	auth.login_failed	auth	\N	{"v": 3, "locked": false, "reason": "invalid_grant"}	2026-09-18 19:40:52.407267+00
157	\N	\N	delete.profiles	profiles	dc617bca-d352-4e4a-9910-7e799ed3c073	{"old": {"id": "dc617bca-d352-4e4a-9910-7e799ed3c073", "role": "pending_staff", "email": "kamal1313@gmail.com", "full_name": "Kamal Anand", "is_active": true, "created_at": "2026-09-18T18:49:11.02+00:00"}}	2026-09-18 19:42:39.110091+00
158	\N	\N	delete.profiles	profiles	cf3ece7e-25e4-414d-8f85-2fa623fdd424	{"old": {"id": "cf3ece7e-25e4-414d-8f85-2fa623fdd424", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "Testadmin", "is_active": true, "created_at": "2026-09-18T19:04:38.288+00:00"}}	2026-09-18 19:42:42.542789+00
159	\N	\N	delete.profiles	profiles	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	{"old": {"id": "3dd0ff80-5852-40b9-b7bb-2021e88b44ea", "role": "customer", "email": "alex@gmail.com", "full_name": "Alex", "is_active": true, "created_at": "2026-09-18T19:16:37.726304+00:00"}}	2026-09-18 19:42:46.123255+00
160	\N	\N	user.role_removed	user_roles	3dd0ff80-5852-40b9-b7bb-2021e88b44ea	{"role": "customer", "target_email": null}	2026-09-18 19:42:46.123255+00
161	\N	\N	delete.profiles	profiles	12512035-8758-4ab9-9c08-0c561b0e2066	{"old": {"id": "12512035-8758-4ab9-9c08-0c561b0e2066", "role": "pending_staff", "email": "admin@gmail.com", "full_name": "Admin_test", "is_active": true, "created_at": "2026-09-18T18:53:22.778+00:00"}}	2026-09-18 19:42:51.707438+00
162	\N	probe.customer.1@example.com	auth.login_failed	auth	\N	{"v": 4, "door": "customer", "locked": false, "reason": "unknown_email"}	2026-09-18 19:46:24.907236+00
163	\N	\N	user.role_granted	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 19:47:56.103819+00
164	\N	\N	update.profiles	profiles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"new": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}, "old": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:47:56.382255+00
165	\N	\N	user.role_removed	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:47:56.489559+00
166	\N	\N	user.role_removed	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:47:56.489559+00
167	\N	\N	user.role_removed	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:47:56.489559+00
168	\N	\N	user.role_removed	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "customer", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:47:56.489559+00
169	\N	\N	user.role_removed	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 19:47:56.489559+00
170	\N	\N	user.role_removed	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 19:47:56.489559+00
171	\N	\N	update.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"new": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:47:56.548492+00
172	\N	\N	user.role_granted	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:47:56.548492+00
173	\N	\N	update.profiles	profiles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"new": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:22.988+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:22.988+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:47:56.548492+00
174	\N	\N	user.role_granted	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:47:56.548492+00
175	\N	\N	update.profiles	profiles	932a2a90-2f85-43a0-9949-2dc879500c62	{"new": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.429+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.429+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:47:56.548492+00
176	\N	\N	user.role_granted	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:47:56.548492+00
177	\N	\N	update.profiles	profiles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"new": {"id": "91e0db3a-6081-4bad-bc07-eda044a477bb", "role": "customer", "email": "newuser@gmail.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:39:45.442046+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "91e0db3a-6081-4bad-bc07-eda044a477bb", "role": "customer", "email": "newuser@gmail.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:39:45.442046+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:47:56.548492+00
178	\N	\N	user.role_granted	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 19:47:56.548492+00
179	\N	\N	update.profiles	profiles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"new": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}, "old": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}}	2026-09-18 19:47:56.548492+00
180	\N	\N	user.role_granted	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 19:47:56.548492+00
181	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	\N	user.role_changed	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"v": 4, "roles": ["customer"], "granted": [], "revoked": ["admin"]}	2026-09-18 19:47:56.637712+00
182	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	probe.customer.2@example.com	auth.registered	profiles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"v": 5, "door": "customer", "hash": "bcrypt-2a", "role": "customer", "roles": ["customer"]}	2026-09-18 19:47:56.759121+00
183	\N	probe.customer.2@example.com	auth.login_failed	auth	\N	{"v": 5, "door": "customer", "locked": false, "reason": "unknown_email"}	2026-09-18 19:48:06.084482+00
184	\N	probe.customer.2@example.com	auth.login_failed	auth	\N	{"v": 4, "door": "customer", "locked": false, "reason": "unknown_email"}	2026-09-18 19:48:06.650337+00
206	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	probe.alpha.91@example.com	auth.registered	profiles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"v": 5, "door": "customer", "hash": "bcrypt-2a", "role": "customer", "roles": ["customer"]}	2026-09-18 19:49:49.759669+00
207	\N	probe.customer.2@example.com	auth.login_failed	auth	\N	{"v": 4, "door": "customer", "locked": false, "reason": "unknown_email"}	2026-09-18 19:49:50.505663+00
185	\N	\N	user.role_granted	user_roles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"role": "customer", "target_email": "probe.alpha.91@example.com"}	2026-09-18 19:49:48.490205+00
186	\N	\N	update.profiles	profiles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"new": {"id": "16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5", "role": "customer", "email": "probe.alpha.91@example.com", "full_name": "Probe Alpha", "is_active": true, "created_at": "2026-09-18T19:49:48.490205+00:00", "password_hash": "$2a$10$6UMA7r6n4Srb0hX7......Bn//wyafWnhgwIHxTKqhdns/3pReqxy", "password_updated_at": "2026-09-18T19:49:49.301+00:00"}, "old": {"id": "16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5", "role": "customer", "email": "probe.alpha.91@example.com", "full_name": "Probe Alpha", "is_active": true, "created_at": "2026-09-18T19:49:48.490205+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:49:49.333091+00
193	\N	\N	update.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"new": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:49:49.584963+00
194	\N	\N	user.role_granted	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:49:49.584963+00
195	\N	\N	update.profiles	profiles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"new": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:22.988+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:22.988+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:49:49.584963+00
196	\N	\N	user.role_granted	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:49:49.584963+00
197	\N	\N	update.profiles	profiles	932a2a90-2f85-43a0-9949-2dc879500c62	{"new": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.429+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.429+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:49:49.584963+00
198	\N	\N	user.role_granted	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:49:49.584963+00
199	\N	\N	update.profiles	profiles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"new": {"id": "91e0db3a-6081-4bad-bc07-eda044a477bb", "role": "customer", "email": "newuser@gmail.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:39:45.442046+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "91e0db3a-6081-4bad-bc07-eda044a477bb", "role": "customer", "email": "newuser@gmail.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:39:45.442046+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:49:49.584963+00
200	\N	\N	user.role_granted	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 19:49:49.584963+00
201	\N	\N	update.profiles	profiles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"new": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}, "old": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}}	2026-09-18 19:49:49.584963+00
202	\N	\N	user.role_granted	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 19:49:49.584963+00
203	\N	\N	update.profiles	profiles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"new": {"id": "16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5", "role": "customer", "email": "probe.alpha.91@example.com", "full_name": "Probe Alpha", "is_active": true, "created_at": "2026-09-18T19:49:48.490205+00:00", "password_hash": "$2a$10$6UMA7r6n4Srb0hX7......Bn//wyafWnhgwIHxTKqhdns/3pReqxy", "password_updated_at": "2026-09-18T19:49:49.301+00:00"}, "old": {"id": "16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5", "role": "customer", "email": "probe.alpha.91@example.com", "full_name": "Probe Alpha", "is_active": true, "created_at": "2026-09-18T19:49:48.490205+00:00", "password_hash": "$2a$10$6UMA7r6n4Srb0hX7......Bn//wyafWnhgwIHxTKqhdns/3pReqxy", "password_updated_at": "2026-09-18T19:49:49.301+00:00"}}	2026-09-18 19:49:49.584963+00
204	\N	\N	user.role_granted	user_roles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"role": "customer", "target_email": "probe.alpha.91@example.com"}	2026-09-18 19:49:49.584963+00
187	\N	\N	user.role_removed	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:49:49.465234+00
188	\N	\N	user.role_removed	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:49:49.465234+00
189	\N	\N	user.role_removed	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:49:49.465234+00
190	\N	\N	user.role_removed	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 19:49:49.465234+00
191	\N	\N	user.role_removed	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 19:49:49.465234+00
192	\N	\N	user.role_removed	user_roles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"role": "customer", "target_email": "probe.alpha.91@example.com"}	2026-09-18 19:49:49.465234+00
205	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	\N	user.role_changed	user_roles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"v": 4, "roles": ["customer"], "granted": [], "revoked": ["admin"]}	2026-09-18 19:49:49.659167+00
208	\N	probe.alpha.91@example.com	auth.login_failed	auth	\N	{"v": 5, "door": "customer", "locked": false, "reason": "unknown_email"}	2026-09-18 19:49:54.85907+00
209	\N	\N	user.role_granted	user_roles	464d8390-555a-41cd-944a-435f339a35b9	{"role": "customer", "target_email": "ramsharma@gmail.com"}	2026-09-18 19:50:39.27407+00
210	\N	\N	update.profiles	profiles	464d8390-555a-41cd-944a-435f339a35b9	{"new": {"id": "464d8390-555a-41cd-944a-435f339a35b9", "role": "customer", "email": "ramsharma@gmail.com", "full_name": "ram sharma", "is_active": true, "created_at": "2026-09-18T19:50:39.27407+00:00", "password_hash": "$2a$10$XoQcOlgJtCgBQA7Y......IoCk5e1HmbvJ1Ie6GTimWzoCyuHsX7i", "password_updated_at": "2026-09-18T19:50:39.494+00:00"}, "old": {"id": "464d8390-555a-41cd-944a-435f339a35b9", "role": "customer", "email": "ramsharma@gmail.com", "full_name": "ram sharma", "is_active": true, "created_at": "2026-09-18T19:50:39.27407+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:50:39.504677+00
211	\N	\N	user.role_removed	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:50:39.600007+00
212	\N	\N	user.role_removed	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:50:39.600007+00
213	\N	\N	user.role_removed	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:50:39.600007+00
214	\N	\N	user.role_removed	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 19:50:39.600007+00
215	\N	\N	user.role_removed	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 19:50:39.600007+00
216	\N	\N	user.role_removed	user_roles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"role": "customer", "target_email": "probe.alpha.91@example.com"}	2026-09-18 19:50:39.600007+00
217	\N	\N	user.role_removed	user_roles	464d8390-555a-41cd-944a-435f339a35b9	{"role": "customer", "target_email": "ramsharma@gmail.com"}	2026-09-18 19:50:39.600007+00
218	\N	\N	update.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"new": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:50:39.65761+00
219	\N	\N	user.role_granted	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "admin", "target_email": "uminder1313@gmail.com"}	2026-09-18 19:50:39.65761+00
220	\N	\N	update.profiles	profiles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"new": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:22.988+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:22.988+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:50:39.65761+00
221	\N	\N	user.role_granted	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 19:50:39.65761+00
222	\N	\N	update.profiles	profiles	932a2a90-2f85-43a0-9949-2dc879500c62	{"new": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.429+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.429+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:50:39.65761+00
223	\N	\N	user.role_granted	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 19:50:39.65761+00
224	\N	\N	update.profiles	profiles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"new": {"id": "91e0db3a-6081-4bad-bc07-eda044a477bb", "role": "customer", "email": "newuser@gmail.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:39:45.442046+00:00", "password_hash": null, "password_updated_at": null}, "old": {"id": "91e0db3a-6081-4bad-bc07-eda044a477bb", "role": "customer", "email": "newuser@gmail.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:39:45.442046+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 19:50:39.65761+00
225	\N	\N	user.role_granted	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 19:50:39.65761+00
226	\N	\N	update.profiles	profiles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"new": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}, "old": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}}	2026-09-18 19:50:39.65761+00
227	\N	\N	user.role_granted	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 19:50:39.65761+00
228	\N	\N	update.profiles	profiles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"new": {"id": "16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5", "role": "customer", "email": "probe.alpha.91@example.com", "full_name": "Probe Alpha", "is_active": true, "created_at": "2026-09-18T19:49:48.490205+00:00", "password_hash": "$2a$10$6UMA7r6n4Srb0hX7......Bn//wyafWnhgwIHxTKqhdns/3pReqxy", "password_updated_at": "2026-09-18T19:49:49.301+00:00"}, "old": {"id": "16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5", "role": "customer", "email": "probe.alpha.91@example.com", "full_name": "Probe Alpha", "is_active": true, "created_at": "2026-09-18T19:49:48.490205+00:00", "password_hash": "$2a$10$6UMA7r6n4Srb0hX7......Bn//wyafWnhgwIHxTKqhdns/3pReqxy", "password_updated_at": "2026-09-18T19:49:49.301+00:00"}}	2026-09-18 19:50:39.65761+00
229	\N	\N	user.role_granted	user_roles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"role": "customer", "target_email": "probe.alpha.91@example.com"}	2026-09-18 19:50:39.65761+00
232	464d8390-555a-41cd-944a-435f339a35b9	\N	user.role_changed	user_roles	464d8390-555a-41cd-944a-435f339a35b9	{"v": 4, "roles": ["customer"], "granted": [], "revoked": ["admin"]}	2026-09-18 19:50:39.751694+00
230	\N	\N	update.profiles	profiles	464d8390-555a-41cd-944a-435f339a35b9	{"new": {"id": "464d8390-555a-41cd-944a-435f339a35b9", "role": "customer", "email": "ramsharma@gmail.com", "full_name": "ram sharma", "is_active": true, "created_at": "2026-09-18T19:50:39.27407+00:00", "password_hash": "$2a$10$XoQcOlgJtCgBQA7Y......IoCk5e1HmbvJ1Ie6GTimWzoCyuHsX7i", "password_updated_at": "2026-09-18T19:50:39.494+00:00"}, "old": {"id": "464d8390-555a-41cd-944a-435f339a35b9", "role": "customer", "email": "ramsharma@gmail.com", "full_name": "ram sharma", "is_active": true, "created_at": "2026-09-18T19:50:39.27407+00:00", "password_hash": "$2a$10$XoQcOlgJtCgBQA7Y......IoCk5e1HmbvJ1Ie6GTimWzoCyuHsX7i", "password_updated_at": "2026-09-18T19:50:39.494+00:00"}}	2026-09-18 19:50:39.65761+00
231	\N	\N	user.role_granted	user_roles	464d8390-555a-41cd-944a-435f339a35b9	{"role": "customer", "target_email": "ramsharma@gmail.com"}	2026-09-18 19:50:39.65761+00
240	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	probe.alpha.91@example.com	auth.login_failed	auth	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"v": 6, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 19:57:07.926802+00
233	464d8390-555a-41cd-944a-435f339a35b9	ramsharma@gmail.com	auth.registered	profiles	464d8390-555a-41cd-944a-435f339a35b9	{"v": 5, "door": "customer", "hash": "bcrypt-2a", "role": "customer", "roles": ["customer"]}	2026-09-18 19:50:39.838893+00
234	\N	ramsharma@gmail.com	auth.login_failed	auth	\N	{"v": 4, "door": "customer", "locked": false, "reason": "unknown_email"}	2026-09-18 19:51:00.828712+00
243	464d8390-555a-41cd-944a-435f339a35b9	ramsharma@gmail.com	auth.login	auth	464d8390-555a-41cd-944a-435f339a35b9	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:00:29.932626+00
246	\N	\N	update.profiles	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"new": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$nF3DeVinFFlvBAG3......R9eLmMje6ez/E2kEKOl0FwGc8dYW69W", "password_updated_at": "2026-09-18T20:01:03.716+00:00"}, "old": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:01:03.731111+00
252	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_refused_door	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "door": "admin", "roles": ["customer"]}	2026-09-18 20:01:05.74532+00
253	\N	\N	update.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"new": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": "$2a$10$d/lRy9lR7DnLOyuV......3O7xWNkzAmS8C3QpnTO7vkx8bZg5W3a", "password_updated_at": "2026-09-18T20:01:06.768477+00:00"}, "old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:01:06.768477+00
255	424beae5-1082-4eb2-bc0c-74403dca19db	\N	user.role_granted	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "roles": ["admin", "customer"], "reason": "allowlist", "requested": ["admin", "customer"]}	2026-09-18 20:01:06.92587+00
266	\N	\N	user.role_granted	user_roles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"role": "customer", "target_email": "probe.lockout.7f3a@example.com"}	2026-09-18 20:01:14.469251+00
271	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.registered	profiles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 8, "door": "customer", "hash": "bcrypt-2a", "role": "customer", "roles": ["customer"]}	2026-09-18 20:01:15.075936+00
235	424beae5-1082-4eb2-bc0c-74403dca19db	umminder1313@gmail.com	auth.login_failed	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 6, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 19:52:45.262939+00
236	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	probe.alpha.91@example.com	auth.login	auth	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"v": 6, "via": "own-bcrypt", "door": "customer", "roles": ["admin", "customer", "customer", "customer", "customer", "customer", "customer"]}	2026-09-18 19:53:16.74413+00
237	424beae5-1082-4eb2-bc0c-74403dca19db	probe.beta.77@example.com	auth.login_failed	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 6, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 19:53:31.170254+00
238	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	probe.alpha.91@example.com	auth.login_failed	auth	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"v": 6, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 19:55:27.095069+00
239	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	probe.alpha.91@example.com	auth.login	auth	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"v": 6, "via": "own-bcrypt", "door": "customer", "roles": ["admin", "customer", "customer", "customer", "customer", "customer", "customer"]}	2026-09-18 19:57:07.158881+00
241	464d8390-555a-41cd-944a-435f339a35b9	ramsharma@gmail.com	auth.login	auth	464d8390-555a-41cd-944a-435f339a35b9	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 19:59:08.707572+00
242	464d8390-555a-41cd-944a-435f339a35b9	ramsharma@gmail.com	auth.login_failed	auth	464d8390-555a-41cd-944a-435f339a35b9	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:00:24.674021+00
244	\N	\N	user.role_granted	user_roles	424beae5-1082-4eb2-bc0c-74403dca19db	{"role": "customer", "target_email": "uminder1313@gmail.com"}	2026-09-18 20:01:00.944661+00
245	\N	\N	user.role_granted	user_roles	e477570e-002d-4c27-ba10-14280e133e02	{"role": "customer", "target_email": "probe.nonadmin.7f3a@example.com"}	2026-09-18 20:01:03.370511+00
247	\N	\N	update.profiles	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"new": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$nF3DeVinFFlvBAG3......R9eLmMje6ez/E2kEKOl0FwGc8dYW69W", "password_updated_at": "2026-09-18T20:01:03.865096+00:00"}, "old": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$nF3DeVinFFlvBAG3......R9eLmMje6ez/E2kEKOl0FwGc8dYW69W", "password_updated_at": "2026-09-18T20:01:03.716+00:00"}}	2026-09-18 20:01:03.865096+00
248	\N	\N	update.profiles	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"new": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$nF3DeVinFFlvBAG3......R9eLmMje6ez/E2kEKOl0FwGc8dYW69W", "password_updated_at": "2026-09-18T20:01:03.865096+00:00"}, "old": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$nF3DeVinFFlvBAG3......R9eLmMje6ez/E2kEKOl0FwGc8dYW69W", "password_updated_at": "2026-09-18T20:01:03.865096+00:00"}}	2026-09-18 20:01:03.940883+00
249	e477570e-002d-4c27-ba10-14280e133e02	\N	user.role_changed	user_roles	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "roles": ["customer"], "reason": "self", "requested": ["customer"]}	2026-09-18 20:01:04.07424+00
250	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.registered	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "door": "customer", "hash": "bcrypt-2a", "role": "customer", "roles": ["customer"], "reason": "self"}	2026-09-18 20:01:04.181165+00
251	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:01:04.979924+00
254	\N	\N	update.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"new": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": "$2a$10$d/lRy9lR7DnLOyuV......3O7xWNkzAmS8C3QpnTO7vkx8bZg5W3a", "password_updated_at": "2026-09-18T20:01:06.768477+00:00"}, "old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": "$2a$10$d/lRy9lR7DnLOyuV......3O7xWNkzAmS8C3QpnTO7vkx8bZg5W3a", "password_updated_at": "2026-09-18T20:01:06.768477+00:00"}}	2026-09-18 20:01:06.860133+00
256	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.admin_first_time_setup	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "hash": "bcrypt-2a", "roles": ["admin", "customer"], "reason": "allowlist"}	2026-09-18 20:01:06.984643+00
257	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 8, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:01:07.702758+00
258	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.reset_link_generated	password_reset_tokens	e477570e-002d-4c27-ba10-14280e133e02	{"v": 7, "for": "probe.nonadmin.7f3a@example.com", "scope": "customer", "expires_at": "2026-09-18T21:01:08.713Z"}	2026-09-18 20:01:08.809468+00
259	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.password_change_failed	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8}	2026-09-18 20:01:09.528904+00
260	\N	\N	update.profiles	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"new": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$NLm7v/plE4fN5cRu......T5CDOMTd0UjVH3jnUU1HjlKPWjc1Sn6", "password_updated_at": "2026-09-18T20:01:10.235674+00:00"}, "old": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$nF3DeVinFFlvBAG3......R9eLmMje6ez/E2kEKOl0FwGc8dYW69W", "password_updated_at": "2026-09-18T20:01:03.865096+00:00"}}	2026-09-18 20:01:10.235674+00
261	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.password_changed	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"v": 7, "hash": "bcrypt-2a", "roles": ["customer"]}	2026-09-18 20:01:10.417123+00
262	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:10.942091+00
263	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:01:11.794133+00
264	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:01:13.182773+00
275	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:17.282818+00
265	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:13.794595+00
272	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:15.608294+00
267	\N	\N	update.profiles	profiles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"new": {"id": "dfe185f7-026a-43b5-9305-f8946e5c9613", "role": "customer", "email": "probe.lockout.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:01:14.469251+00:00", "password_hash": "$2a$10$uWZ52Rnh9.xq5H.2......iOvzq7Ai7uuDArf2R6.pEaSe6ZaeR2m", "password_updated_at": "2026-09-18T20:01:14.677+00:00"}, "old": {"id": "dfe185f7-026a-43b5-9305-f8946e5c9613", "role": "customer", "email": "probe.lockout.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:01:14.469251+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:01:14.686486+00
268	\N	\N	update.profiles	profiles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"new": {"id": "dfe185f7-026a-43b5-9305-f8946e5c9613", "role": "customer", "email": "probe.lockout.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:01:14.469251+00:00", "password_hash": "$2a$10$uWZ52Rnh9.xq5H.2......iOvzq7Ai7uuDArf2R6.pEaSe6ZaeR2m", "password_updated_at": "2026-09-18T20:01:14.755204+00:00"}, "old": {"id": "dfe185f7-026a-43b5-9305-f8946e5c9613", "role": "customer", "email": "probe.lockout.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:01:14.469251+00:00", "password_hash": "$2a$10$uWZ52Rnh9.xq5H.2......iOvzq7Ai7uuDArf2R6.pEaSe6ZaeR2m", "password_updated_at": "2026-09-18T20:01:14.677+00:00"}}	2026-09-18 20:01:14.755204+00
269	\N	\N	update.profiles	profiles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"new": {"id": "dfe185f7-026a-43b5-9305-f8946e5c9613", "role": "customer", "email": "probe.lockout.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:01:14.469251+00:00", "password_hash": "$2a$10$uWZ52Rnh9.xq5H.2......iOvzq7Ai7uuDArf2R6.pEaSe6ZaeR2m", "password_updated_at": "2026-09-18T20:01:14.755204+00:00"}, "old": {"id": "dfe185f7-026a-43b5-9305-f8946e5c9613", "role": "customer", "email": "probe.lockout.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:01:14.469251+00:00", "password_hash": "$2a$10$uWZ52Rnh9.xq5H.2......iOvzq7Ai7uuDArf2R6.pEaSe6ZaeR2m", "password_updated_at": "2026-09-18T20:01:14.755204+00:00"}}	2026-09-18 20:01:14.875642+00
274	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:16.731039+00
270	dfe185f7-026a-43b5-9305-f8946e5c9613	\N	user.role_changed	user_roles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 8, "roles": ["customer"]}	2026-09-18 20:01:14.998416+00
273	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:16.120471+00
276	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 9, "door": "customer", "locked": true, "reason": "bad_password"}	2026-09-18 20:01:17.840466+00
277	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:37.724302+00
278	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "admin", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:38.352916+00
279	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 8, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:01:39.370243+00
280	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.reset_link_generated	password_reset_tokens	e477570e-002d-4c27-ba10-14280e133e02	{"v": 7, "for": "probe.nonadmin.7f3a@example.com", "scope": "customer", "expires_at": "2026-09-18T21:01:40.342Z"}	2026-09-18 20:01:40.43113+00
281	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:41.031938+00
282	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:01:41.827265+00
283	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:01:43.152189+00
284	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:43.807486+00
285	\N	\N	user.role_granted	user_roles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"role": "customer", "target_email": "probe.customer.7f3a@example.com"}	2026-09-18 20:01:47.811332+00
286	\N	\N	update.profiles	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"new": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$qkXF/UaOJ1HwYifs......w0RiFZ6jasQGyk26J6zGKgmJ.9oK0r2", "password_updated_at": "2026-09-18T20:01:48.006+00:00"}, "old": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:01:48.017259+00
287	\N	\N	update.profiles	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"new": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$qkXF/UaOJ1HwYifs......w0RiFZ6jasQGyk26J6zGKgmJ.9oK0r2", "password_updated_at": "2026-09-18T20:01:48.100521+00:00"}, "old": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$qkXF/UaOJ1HwYifs......w0RiFZ6jasQGyk26J6zGKgmJ.9oK0r2", "password_updated_at": "2026-09-18T20:01:48.006+00:00"}}	2026-09-18 20:01:48.100521+00
288	\N	\N	update.profiles	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"new": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$qkXF/UaOJ1HwYifs......w0RiFZ6jasQGyk26J6zGKgmJ.9oK0r2", "password_updated_at": "2026-09-18T20:01:48.100521+00:00"}, "old": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$qkXF/UaOJ1HwYifs......w0RiFZ6jasQGyk26J6zGKgmJ.9oK0r2", "password_updated_at": "2026-09-18T20:01:48.100521+00:00"}}	2026-09-18 20:01:48.181594+00
289	2096e9e3-ec91-4afc-af2f-45d44dd6d854	\N	user.role_changed	user_roles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 9, "roles": ["customer"], "reason": "self", "requested": ["customer"]}	2026-09-18 20:01:48.260144+00
290	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.registered	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 9, "door": "customer", "hash": "bcrypt-2a", "role": "customer", "roles": ["customer"], "reason": "self"}	2026-09-18 20:01:48.339154+00
291	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.login	auth	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:01:49.124538+00
292	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.password_change_failed	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 7}	2026-09-18 20:01:50.056187+00
293	\N	\N	update.profiles	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"new": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$YsV1lo4uf66VZB/t.......2PXR4O7TuMk5b11p0dwemX/pAzYpKe", "password_updated_at": "2026-09-18T20:01:51.164704+00:00"}, "old": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$qkXF/UaOJ1HwYifs......w0RiFZ6jasQGyk26J6zGKgmJ.9oK0r2", "password_updated_at": "2026-09-18T20:01:48.100521+00:00"}}	2026-09-18 20:01:51.164704+00
294	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.password_changed	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 8, "hash": "bcrypt-2a", "roles": ["customer"]}	2026-09-18 20:01:51.315632+00
295	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.login_failed	auth	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:01:52.787584+00
296	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.login	auth	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:01:53.844479+00
297	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:02:03.530588+00
298	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:05.369168+00
316	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.login	auth	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:02:25.40441+00
323	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.reset_link_generated	password_reset_tokens	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "for": "probe.nonadmin.7f3a@example.com", "scope": "customer", "expires_at": "2026-09-18T21:03:07.995Z"}	2026-09-18 20:03:08.07583+00
325	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:03:09.339751+00
340	\N	\N	user.role_removed	user_roles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"role": "customer", "target_email": "verify.probe.one@example.com"}	2026-09-18 20:03:41.290723+00
341	\N	\N	user.role_removed	user_roles	932a2a90-2f85-43a0-9949-2dc879500c62	{"role": "customer", "target_email": "verify.probe.four.b7d2@example.com"}	2026-09-18 20:03:41.290723+00
342	\N	\N	user.role_removed	user_roles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"role": "customer", "target_email": "newuser@gmail.com"}	2026-09-18 20:03:41.290723+00
343	\N	\N	user.role_removed	user_roles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"role": "customer", "target_email": "probe.customer.2@example.com"}	2026-09-18 20:03:41.290723+00
344	\N	\N	user.role_removed	user_roles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"role": "customer", "target_email": "probe.alpha.91@example.com"}	2026-09-18 20:03:41.290723+00
345	\N	\N	user.role_removed	user_roles	e477570e-002d-4c27-ba10-14280e133e02	{"role": "customer", "target_email": "probe.nonadmin.7f3a@example.com"}	2026-09-18 20:03:41.290723+00
346	\N	\N	user.role_removed	user_roles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"role": "customer", "target_email": "probe.lockout.7f3a@example.com"}	2026-09-18 20:03:41.290723+00
347	\N	\N	user.role_removed	user_roles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"role": "customer", "target_email": "probe.customer.7f3a@example.com"}	2026-09-18 20:03:41.290723+00
348	\N	\N	user.role_removed	user_roles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"role": "customer", "target_email": "probe.lock2.7f3a@example.com"}	2026-09-18 20:03:41.290723+00
349	\N	\N	delete.profiles	profiles	dfe185f7-026a-43b5-9305-f8946e5c9613	{"old": {"id": "dfe185f7-026a-43b5-9305-f8946e5c9613", "role": "customer", "email": "probe.lockout.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:01:14.469251+00:00", "password_hash": "$2a$10$uWZ52Rnh9.xq5H.2......iOvzq7Ai7uuDArf2R6.pEaSe6ZaeR2m", "password_updated_at": "2026-09-18T20:01:14.755204+00:00"}}	2026-09-18 20:03:41.290723+00
350	\N	\N	delete.profiles	profiles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"old": {"id": "685440a1-81e0-41dc-8a1d-49d6306a2b62", "role": "customer", "email": "probe.lock2.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:02:13.105156+00:00", "password_hash": "$2a$10$tb1c1RdVfHLK733/......wXdO2uUR2Ow4iB3bMjRebAsb14s3PTq", "password_updated_at": "2026-09-18T20:02:13.421007+00:00"}}	2026-09-18 20:03:41.290723+00
351	\N	\N	delete.profiles	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"old": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$oa5jS2NR95QO1Irp......XW2mVD4YeqjtM2mOhh6UazFPqxOFJtu", "password_updated_at": "2026-09-18T20:03:10.353457+00:00"}}	2026-09-18 20:03:41.290723+00
352	\N	\N	delete.profiles	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"old": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$.47A/KVNufTylGP6......InjjrcPPxuYGPMBkoPFpdgtt4LgT43q", "password_updated_at": "2026-09-18T20:03:31.783178+00:00"}}	2026-09-18 20:03:41.290723+00
353	\N	\N	delete.profiles	profiles	cdc14cf6-90f6-4b86-8389-da3e0a06266f	{"old": {"id": "cdc14cf6-90f6-4b86-8389-da3e0a06266f", "role": "customer", "email": "verify.probe.one@example.com", "full_name": "Verify Probe One", "is_active": true, "created_at": "2026-09-18T19:23:22.988+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:03:41.290723+00
354	\N	\N	delete.profiles	profiles	932a2a90-2f85-43a0-9949-2dc879500c62	{"old": {"id": "932a2a90-2f85-43a0-9949-2dc879500c62", "role": "customer", "email": "verify.probe.four.b7d2@example.com", "full_name": "Verify Probe Four", "is_active": true, "created_at": "2026-09-18T19:27:38.429+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:03:41.290723+00
355	\N	\N	delete.profiles	profiles	91e0db3a-6081-4bad-bc07-eda044a477bb	{"old": {"id": "91e0db3a-6081-4bad-bc07-eda044a477bb", "role": "customer", "email": "newuser@gmail.com", "full_name": null, "is_active": true, "created_at": "2026-09-18T19:39:45.442046+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:03:41.290723+00
356	\N	\N	delete.profiles	profiles	2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	{"old": {"id": "2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6", "role": "customer", "email": "probe.customer.2@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T19:47:56.103819+00:00", "password_hash": "$2a$10$zO0QfEPzvsYlsclG......MGimsVRMxfNCa8NvdogCnB6zAZaVAUi", "password_updated_at": "2026-09-18T19:47:56.372+00:00"}}	2026-09-18 20:03:41.290723+00
357	\N	\N	delete.profiles	profiles	16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	{"old": {"id": "16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5", "role": "customer", "email": "probe.alpha.91@example.com", "full_name": "Probe Alpha", "is_active": true, "created_at": "2026-09-18T19:49:48.490205+00:00", "password_hash": "$2a$10$6UMA7r6n4Srb0hX7......Bn//wyafWnhgwIHxTKqhdns/3pReqxy", "password_updated_at": "2026-09-18T19:49:49.301+00:00"}}	2026-09-18 20:03:41.290723+00
299	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "door": "admin", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:05.999976+00
300	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:02:07.386303+00
301	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.reset_link_generated	password_reset_tokens	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "for": "probe.nonadmin.7f3a@example.com", "scope": "customer", "expires_at": "2026-09-18T21:02:08.526Z"}	2026-09-18 20:02:08.616967+00
302	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:09.186882+00
307	685440a1-81e0-41dc-8a1d-49d6306a2b62	\N	user.role_changed	user_roles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"v": 9, "roles": ["customer"], "reason": "self", "requested": ["customer"]}	2026-09-18 20:02:13.604457+00
312	685440a1-81e0-41dc-8a1d-49d6306a2b62	probe.lock2.7f3a@example.com	auth.login_failed	auth	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:15.972061+00
322	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:03:07.018162+00
330	\N	\N	auth.reset_failed	password_reset_tokens	\N	{"v": 7, "reason": "already_used"}	2026-09-18 20:03:12.89125+00
334	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:15.731609+00
338	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.password_reset	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 8, "hash": "bcrypt-2a", "scope": "customer"}	2026-09-18 20:03:31.939142+00
303	\N	\N	user.role_granted	user_roles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"role": "customer", "target_email": "probe.lock2.7f3a@example.com"}	2026-09-18 20:02:13.105156+00
311	685440a1-81e0-41dc-8a1d-49d6306a2b62	probe.lock2.7f3a@example.com	auth.login_failed	auth	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:15.361253+00
313	685440a1-81e0-41dc-8a1d-49d6306a2b62	probe.lock2.7f3a@example.com	auth.login_failed	auth	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"v": 8, "door": "customer", "locked": true, "reason": "bad_password"}	2026-09-18 20:02:16.705197+00
319	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.login_failed	auth	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:28.522708+00
326	\N	\N	update.profiles	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"new": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$oa5jS2NR95QO1Irp......XW2mVD4YeqjtM2mOhh6UazFPqxOFJtu", "password_updated_at": "2026-09-18T20:03:10.353457+00:00"}, "old": {"id": "e477570e-002d-4c27-ba10-14280e133e02", "role": "customer", "email": "probe.nonadmin.7f3a@example.com", "full_name": "Probe Nonadmin", "is_active": true, "created_at": "2026-09-18T20:01:03.370511+00:00", "password_hash": "$2a$10$NLm7v/plE4fN5cRu......T5CDOMTd0UjVH3jnUU1HjlKPWjc1Sn6", "password_updated_at": "2026-09-18T20:01:10.235674+00:00"}}	2026-09-18 20:03:10.353457+00
331	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:13.771834+00
333	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:14.98623+00
337	\N	\N	update.profiles	profiles	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"new": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$.47A/KVNufTylGP6......InjjrcPPxuYGPMBkoPFpdgtt4LgT43q", "password_updated_at": "2026-09-18T20:03:31.783178+00:00"}, "old": {"id": "2096e9e3-ec91-4afc-af2f-45d44dd6d854", "role": "customer", "email": "probe.customer.7f3a@example.com", "full_name": "Probe Customer", "is_active": true, "created_at": "2026-09-18T20:01:47.811332+00:00", "password_hash": "$2a$10$YsV1lo4uf66VZB/t.......2PXR4O7TuMk5b11p0dwemX/pAzYpKe", "password_updated_at": "2026-09-18T20:01:51.164704+00:00"}}	2026-09-18 20:03:31.783178+00
304	\N	\N	update.profiles	profiles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"new": {"id": "685440a1-81e0-41dc-8a1d-49d6306a2b62", "role": "customer", "email": "probe.lock2.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:02:13.105156+00:00", "password_hash": "$2a$10$tb1c1RdVfHLK733/......wXdO2uUR2Ow4iB3bMjRebAsb14s3PTq", "password_updated_at": "2026-09-18T20:02:13.328+00:00"}, "old": {"id": "685440a1-81e0-41dc-8a1d-49d6306a2b62", "role": "customer", "email": "probe.lock2.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:02:13.105156+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:02:13.340007+00
305	\N	\N	update.profiles	profiles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"new": {"id": "685440a1-81e0-41dc-8a1d-49d6306a2b62", "role": "customer", "email": "probe.lock2.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:02:13.105156+00:00", "password_hash": "$2a$10$tb1c1RdVfHLK733/......wXdO2uUR2Ow4iB3bMjRebAsb14s3PTq", "password_updated_at": "2026-09-18T20:02:13.421007+00:00"}, "old": {"id": "685440a1-81e0-41dc-8a1d-49d6306a2b62", "role": "customer", "email": "probe.lock2.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:02:13.105156+00:00", "password_hash": "$2a$10$tb1c1RdVfHLK733/......wXdO2uUR2Ow4iB3bMjRebAsb14s3PTq", "password_updated_at": "2026-09-18T20:02:13.328+00:00"}}	2026-09-18 20:02:13.421007+00
306	\N	\N	update.profiles	profiles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"new": {"id": "685440a1-81e0-41dc-8a1d-49d6306a2b62", "role": "customer", "email": "probe.lock2.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:02:13.105156+00:00", "password_hash": "$2a$10$tb1c1RdVfHLK733/......wXdO2uUR2Ow4iB3bMjRebAsb14s3PTq", "password_updated_at": "2026-09-18T20:02:13.421007+00:00"}, "old": {"id": "685440a1-81e0-41dc-8a1d-49d6306a2b62", "role": "customer", "email": "probe.lock2.7f3a@example.com", "full_name": "Probe Lockout", "is_active": true, "created_at": "2026-09-18T20:02:13.105156+00:00", "password_hash": "$2a$10$tb1c1RdVfHLK733/......wXdO2uUR2Ow4iB3bMjRebAsb14s3PTq", "password_updated_at": "2026-09-18T20:02:13.421007+00:00"}}	2026-09-18 20:02:13.519148+00
310	685440a1-81e0-41dc-8a1d-49d6306a2b62	probe.lock2.7f3a@example.com	auth.login_failed	auth	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:14.814976+00
315	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:02:24.26733+00
317	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.reset_link_generated	password_reset_tokens	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 8, "for": "probe.customer.7f3a@example.com", "scope": "customer", "expires_at": "2026-09-18T21:02:26.196Z"}	2026-09-18 20:02:26.291328+00
308	685440a1-81e0-41dc-8a1d-49d6306a2b62	probe.lock2.7f3a@example.com	auth.registered	profiles	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"v": 9, "door": "customer", "hash": "bcrypt-2a", "role": "customer", "roles": ["customer"], "reason": "self"}	2026-09-18 20:02:13.689181+00
324	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:08.660786+00
309	685440a1-81e0-41dc-8a1d-49d6306a2b62	probe.lock2.7f3a@example.com	auth.login_failed	auth	685440a1-81e0-41dc-8a1d-49d6306a2b62	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:14.22818+00
314	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login_failed	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 8, "door": "admin", "locked": false, "reason": "bad_password"}	2026-09-18 20:02:16.74129+00
318	2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	auth.login	auth	2096e9e3-ec91-4afc-af2f-45d44dd6d854	{"v": 8, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:02:27.813907+00
320	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:05.18459+00
321	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "door": "admin", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:05.847418+00
327	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.password_reset	profiles	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "hash": "bcrypt-2a", "scope": "customer"}	2026-09-18 20:03:10.492211+00
328	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login_failed	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 8, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:10.977579+00
329	e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	auth.login	auth	e477570e-002d-4c27-ba10-14280e133e02	{"v": 9, "via": "own-bcrypt", "door": "customer", "roles": ["customer"]}	2026-09-18 20:03:12.381149+00
332	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 9, "door": "customer", "locked": false, "reason": "bad_password"}	2026-09-18 20:03:14.429636+00
335	dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	auth.login_failed	auth	dfe185f7-026a-43b5-9305-f8946e5c9613	{"v": 8, "door": "customer", "locked": true, "reason": "bad_password"}	2026-09-18 20:03:16.318803+00
336	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:03:17.816965+00
339	\N	\N	auth.reset_failed	password_reset_tokens	\N	{"v": 7, "reason": "already_used"}	2026-09-18 20:03:41.175835+00
358	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "customer", "roles": ["admin", "customer"]}	2026-09-18 20:05:39.700054+00
359	424beae5-1082-4eb2-bc0c-74403dca19db	\N	auth.logout	auth_sessions	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9}	2026-09-18 20:06:30.763391+00
360	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "customer", "roles": ["admin", "customer"]}	2026-09-18 20:07:03.577332+00
361	\N	\N	update.profiles	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"new": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": "$2a$10$ZzgY2CZ5JH8xghz3......eUYupIUMJ.eCyMyLL/U/WnBh3fXtl4K", "password_updated_at": "2026-09-18T20:08:15.934274+00:00"}, "old": {"id": "424beae5-1082-4eb2-bc0c-74403dca19db", "role": "admin", "email": "uminder1313@gmail.com", "full_name": "Uminder Singh", "is_active": true, "created_at": "2026-09-18T17:47:38.156173+00:00", "password_hash": "$2a$10$d/lRy9lR7DnLOyuV......3O7xWNkzAmS8C3QpnTO7vkx8bZg5W3a", "password_updated_at": "2026-09-18T20:01:06.768477+00:00"}}	2026-09-18 20:08:15.934274+00
362	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.password_changed	profiles	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 8, "hash": "bcrypt-2a", "roles": ["admin", "customer"]}	2026-09-18 20:08:16.157506+00
363	424beae5-1082-4eb2-bc0c-74403dca19db	\N	auth.logout	auth_sessions	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9}	2026-09-18 20:08:23.646537+00
364	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "customer", "roles": ["admin", "customer"]}	2026-09-18 20:08:41.981192+00
365	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	update.road_notes	road_notes	1	{"new": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": false, "published_at": null, "read_minutes": 6}, "old": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": true, "published_at": "2026-09-18T16:35:55.967725+00:00", "read_minutes": 6}}	2026-09-18 20:08:54.983082+00
366	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	update.road_notes	road_notes	1	{"new": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": true, "published_at": "2026-09-18T20:06:33.773+00:00", "read_minutes": 6}, "old": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": false, "published_at": null, "read_minutes": 6}}	2026-09-18 20:08:55.571612+00
367	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	update.road_notes	road_notes	1	{"new": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": false, "published_at": null, "read_minutes": 6}, "old": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": true, "published_at": "2026-09-18T20:06:33.773+00:00", "read_minutes": 6}}	2026-09-18 20:08:56.545336+00
368	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	update.road_notes	road_notes	1	{"new": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": true, "published_at": "2026-09-18T20:06:35.866+00:00", "read_minutes": 6}, "old": {"id": 1, "body": "", "title": "Why diesel gels at −25° and how TO stop it.", "category": "Winter", "created_at": "2026-09-18T16:35:55.967725+00:00", "sort_order": 1, "is_published": false, "published_at": null, "read_minutes": 6}}	2026-09-18 20:08:57.661209+00
369	424beae5-1082-4eb2-bc0c-74403dca19db	\N	auth.logout	auth_sessions	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9}	2026-09-18 20:10:32.974555+00
370	\N	\N	user.role_granted	user_roles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"role": "customer", "target_email": "testadmin@gmail.com"}	2026-09-18 20:11:16.510121+00
371	\N	\N	update.profiles	profiles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"new": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.752+00:00"}, "old": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "customer", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": null, "password_updated_at": null}}	2026-09-18 20:11:16.787257+00
373	\N	\N	user.role_removed	user_roles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"role": "customer", "target_email": "testadmin@gmail.com"}	2026-09-18 20:11:16.928868+00
372	\N	\N	update.profiles	profiles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"new": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}, "old": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.752+00:00"}}	2026-09-18 20:11:16.851893+00
374	\N	\N	update.profiles	profiles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"new": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}, "old": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}}	2026-09-18 20:11:16.928868+00
377	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	testadmin@gmail.com	auth.login_failed	auth	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"v": 9, "door": "admin", "locked": false, "reason": "bad_password"}	2026-09-18 20:11:37.266618+00
379	\N	\N	user.role_granted	user_roles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"role": "admin", "target_email": "testadmin@gmail.com"}	2026-09-18 20:12:26.25658+00
380	\N	\N	update.profiles	profiles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"new": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "admin", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}, "old": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "pending_staff", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}}	2026-09-18 20:12:26.25658+00
381	\N	\N	update.profiles	profiles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"new": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "admin", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}, "old": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "admin", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}}	2026-09-18 20:12:26.25658+00
375	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	\N	user.role_changed	user_roles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"v": 9, "roles": [], "reason": "self", "requested": []}	2026-09-18 20:11:16.993215+00
376	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	testadmin@gmail.com	auth.admin_registered	profiles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"v": 9, "door": "staff", "hash": "bcrypt-2a", "role": "pending_staff", "roles": [], "reason": "self"}	2026-09-18 20:11:17.044867+00
378	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:12:07.684264+00
382	424beae5-1082-4eb2-bc0c-74403dca19db	\N	user.role_granted	user_roles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"v": 9, "roles": ["admin"], "reason": "manual by 424beae5-1082-4eb2-bc0c-74403dca19db", "requested": ["admin"]}	2026-09-18 20:12:26.353413+00
383	424beae5-1082-4eb2-bc0c-74403dca19db	\N	auth.logout	auth_sessions	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9}	2026-09-18 20:12:42.539735+00
384	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	testadmin@gmail.com	auth.login_failed	auth	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"v": 9, "door": "admin", "locked": false, "reason": "bad_password"}	2026-09-18 20:13:03.917296+00
386	\N	\N	user.role_granted	user_roles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"role": "customer", "target_email": "testadmin@gmail.com"}	2026-09-18 20:13:32.876752+00
387	\N	\N	update.profiles	profiles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"new": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "admin", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}, "old": {"id": "a8bc0ead-21e7-402c-bb3f-f0d52350a9de", "role": "admin", "email": "testadmin@gmail.com", "full_name": "testadmin", "is_active": true, "created_at": "2026-09-18T20:11:16.510121+00:00", "password_hash": "$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6", "password_updated_at": "2026-09-18T20:11:16.851893+00:00"}}	2026-09-18 20:13:32.876752+00
388	424beae5-1082-4eb2-bc0c-74403dca19db	\N	user.role_granted	user_roles	a8bc0ead-21e7-402c-bb3f-f0d52350a9de	{"v": 9, "roles": ["admin", "customer"], "reason": "manual by 424beae5-1082-4eb2-bc0c-74403dca19db", "requested": ["admin", "customer"]}	2026-09-18 20:13:32.989384+00
385	424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	auth.login	auth	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9, "via": "own-bcrypt", "door": "admin", "roles": ["admin", "customer"]}	2026-09-18 20:13:20.917418+00
389	424beae5-1082-4eb2-bc0c-74403dca19db	\N	auth.logout	auth_sessions	424beae5-1082-4eb2-bc0c-74403dca19db	{"v": 9}	2026-09-18 20:13:50.996353+00
\.


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".auth_sessions (id, user_id, token_hash, issued_at, last_seen_at, expires_at, revoked_at, ip_hash, user_agent) FROM stdin;
3	464d8390-555a-41cd-944a-435f339a35b9	2bb3607d6a6396402f069bc317ca54124099ed5729e7e515bdd368b04d3d0a03	2026-09-18 19:59:08.494803+00	2026-09-18 19:59:08.494803+00	2026-09-25 19:59:08.457+00	\N	47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
4	464d8390-555a-41cd-944a-435f339a35b9	9f19568fd919b4d29ff2e24ea0b0330df3bfd1c579f95c8c22823dfccda6aa05	2026-09-18 20:00:29.767331+00	2026-09-18 20:00:29.767331+00	2026-09-25 20:00:29.759+00	\N	47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
23	424beae5-1082-4eb2-bc0c-74403dca19db	eb6f224614dedc88b6275b8ab14936866b6dc78e83a96572e65d5442b60fcc2c	2026-09-18 20:05:39.539649+00	2026-09-18 20:06:30.550078+00	2026-09-25 20:06:30.550078+00	2026-09-18 20:08:16.077747+00	47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
6	424beae5-1082-4eb2-bc0c-74403dca19db	69fd8a59eae29d7f69ab8e62eec2ca77dd7943d1c955dfcf52a44495a488ac29	2026-09-18 20:01:07.540533+00	2026-09-18 20:01:08.019769+00	2026-09-25 20:01:08.019769+00	2026-09-18 20:06:30.6482+00	bdd737f16087125d32e1e176cd68c13f9e058b4fb619bb91654b495a7b121085	node
9	424beae5-1082-4eb2-bc0c-74403dca19db	9e40782ed7579999aec48d7c32032094c18f2554d33209420a6a042181a7f4d3	2026-09-18 20:01:39.207861+00	2026-09-18 20:01:39.710305+00	2026-09-25 20:01:39.710305+00	2026-09-18 20:06:30.6482+00	bdd737f16087125d32e1e176cd68c13f9e058b4fb619bb91654b495a7b121085	node
14	424beae5-1082-4eb2-bc0c-74403dca19db	ed118dc1032d9e82d9c3b8cb46c6011eacbe72eb466c4caaf1a6c2d249c8259a	2026-09-18 20:02:03.374863+00	2026-09-18 20:02:04.028195+00	2026-09-25 20:02:04.028195+00	2026-09-18 20:06:30.6482+00	e689e581efb6d69d1edc65d859fadd7c2d94327db075f190f8af5f0ad44a42ff	node
15	424beae5-1082-4eb2-bc0c-74403dca19db	2766debccd6e5bf74b253185fb4c9422ff3cdc340c87cad75f81833f5be5df17	2026-09-18 20:02:07.159287+00	2026-09-18 20:02:08.14717+00	2026-09-25 20:02:08.14717+00	2026-09-18 20:06:30.6482+00	bdd737f16087125d32e1e176cd68c13f9e058b4fb619bb91654b495a7b121085	node
16	424beae5-1082-4eb2-bc0c-74403dca19db	16378f4d8d608159899dd4cc2567c5a0ede0e6b24c406fc4e1732e8ff9def29e	2026-09-18 20:02:23.951888+00	2026-09-18 20:02:25.80988+00	2026-09-25 20:02:25.80988+00	2026-09-18 20:06:30.6482+00	e689e581efb6d69d1edc65d859fadd7c2d94327db075f190f8af5f0ad44a42ff	node
19	424beae5-1082-4eb2-bc0c-74403dca19db	795b57771eec031b1b52308ba62936cf2880df8aff3bd538b945b28e8210eefe	2026-09-18 20:03:06.852619+00	2026-09-18 20:03:07.644006+00	2026-09-25 20:03:07.644006+00	2026-09-18 20:06:30.6482+00	bdd737f16087125d32e1e176cd68c13f9e058b4fb619bb91654b495a7b121085	node
22	424beae5-1082-4eb2-bc0c-74403dca19db	941956632ff9f4db7980b51fe452e51388d4d5e5e6a6befeec4e1add7883918e	2026-09-18 20:03:17.670795+00	2026-09-18 20:03:18.235228+00	2026-09-25 20:03:18.235228+00	2026-09-18 20:06:30.6482+00	e689e581efb6d69d1edc65d859fadd7c2d94327db075f190f8af5f0ad44a42ff	node
24	424beae5-1082-4eb2-bc0c-74403dca19db	a684e989aca885e36f86093f091a3268ba769f20fe528491e4998b01958ca3b3	2026-09-18 20:07:03.406206+00	2026-09-18 20:08:23.369763+00	2026-09-25 20:08:23.369763+00	2026-09-18 20:10:32.884238+00	47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
25	424beae5-1082-4eb2-bc0c-74403dca19db	7ebb7a8299f154083ddef90729f7702e46e984d3069560a2028a3bd50ee6785e	2026-09-18 20:08:41.834923+00	2026-09-18 20:10:32.798848+00	2026-09-25 20:10:32.798848+00	2026-09-18 20:12:42.442636+00	47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
27	424beae5-1082-4eb2-bc0c-74403dca19db	6b2653921cbfbf221058fd10c6b267ce5014c6991d1f9a389e5bbf1c2a6c71e7	2026-09-18 20:13:20.690097+00	2026-09-18 20:13:50.808488+00	2026-09-25 20:13:50.808488+00	\N	47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
26	424beae5-1082-4eb2-bc0c-74403dca19db	376e4e8d84297d48b1c8bccb9fa80b957ceaa5f7baab21c2653efd6b481e1bfe	2026-09-18 20:12:07.353037+00	2026-09-18 20:12:42.339705+00	2026-09-25 20:12:42.339705+00	2026-09-18 20:13:50.917015+00	47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
\.


--
-- Data for Name: auth_throttle; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".auth_throttle (key, fails, locked_until, updated_at) FROM stdin;
login-acct:9c1ae9ade657c5f1fabeee0a8c68201bef7b623deb7810ad9a5f186090d6ae75	0	2026-09-18 20:18:16.239969+00	2026-09-18 20:03:16.239969+00
login-acct:ddbfa2316698780ebc4c01412bd1140dd1d1091cb4c9cafeda7d66b9c57f4612	2	\N	2026-09-18 20:13:03.748129+00
\.


--
-- Data for Name: crm_appointments; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_appointments (id, calendar_id, contact_id, contact_email, contact_name, contact_phone, title, starts_at, ends_at, status, notes, source, google_event_id, calendly_event_id, assigned_user_id, assigned_membership_id, participant_count, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_availability; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_availability (id, calendar_id, day_of_week, start_time, end_time, is_active, created_at) FROM stdin;
cdb635f3-8c4a-4b5d-a7f9-10008674fd11	6196e322-85ee-4cc6-9ec4-33c031f7dd37	1	09:00:00	17:00:00	t	2026-09-18 16:29:11.952025+00
7ad0b23f-670f-4dfa-9f6a-14295d2a218e	6196e322-85ee-4cc6-9ec4-33c031f7dd37	2	09:00:00	17:00:00	t	2026-09-18 16:29:11.952025+00
7f983b4a-0607-49fb-b6d0-fdf6910967ab	6196e322-85ee-4cc6-9ec4-33c031f7dd37	3	09:00:00	17:00:00	t	2026-09-18 16:29:11.952025+00
f4f33cfa-3134-4423-9056-7de500403a77	6196e322-85ee-4cc6-9ec4-33c031f7dd37	4	09:00:00	17:00:00	t	2026-09-18 16:29:11.952025+00
c7a0e982-d589-45dc-8add-3f4719ce720a	6196e322-85ee-4cc6-9ec4-33c031f7dd37	5	09:00:00	17:00:00	t	2026-09-18 16:29:11.952025+00
\.


--
-- Data for Name: crm_calendar_members; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_calendar_members (id, calendar_id, user_id, user_google_calendar_id, user_outlook_calendar_id, priority, created_at) FROM stdin;
a75fa120-ea42-4a3b-a9b1-0511e25d504a	6196e322-85ee-4cc6-9ec4-33c031f7dd37	c5662d97-8e2c-4c57-a728-2b33af004a43	\N	\N	0	2026-09-18 16:29:11.878427+00
\.


--
-- Data for Name: crm_calendars; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_calendars (id, name, slug, description, calendar_type, owner_user_id, max_participants, date_range_days, slot_duration, slot_interval, max_bookings_per_day, min_notice_hours, buffer_before, buffer_after, timezone, is_active, meeting_location_type, meeting_location_value, host_notify_on_booking, google_calendar_id, google_refresh_token, calendly_user_uri, calendly_webhook_id, metadata, created_at, updated_at, calendly_connection_id) FROM stdin;
6196e322-85ee-4cc6-9ec4-33c031f7dd37	Default Calendar	\N	\N	personal	c5662d97-8e2c-4c57-a728-2b33af004a43	1	\N	30	0	\N	1	0	0	America/New_York	t	custom	\N	t	\N	\N	\N	\N	{}	2026-09-18 16:29:11.799284+00	2026-09-18 16:29:11.799284+00	\N
\.


--
-- Data for Name: crm_calendly_connections; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_calendly_connections (id, user_id, calendly_user_uri, calendly_user_email, calendly_user_name, calendly_org_uri, encrypted_access_token, signing_key, webhook_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_campaigns; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_campaigns (id, name, subject, html_body, text_body, channel, status, list_id, filter_query, list_ids, style_preset, images, scheduled_at, sent_at, total_recipients, total_sent, total_opened, total_clicked, created_at, from_name, goal_id) FROM stdin;
\.


--
-- Data for Name: crm_contact_lists; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_contact_lists (id, contact_id, list_id, created_at) FROM stdin;
\.


--
-- Data for Name: crm_contacts; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_contacts (id, email, name, phone, sms_opt_in, address, source, tags, metadata, ecom_customer_id, total_orders, total_spent, last_order_at, first_order_at, purchased_product_ids, purchased_product_names, subscribed, subscribed_at, unsubscribed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_events; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_events (id, contact_id, campaign_id, channel, event_type, metadata, created_at, goal_id, flow_id, send_id, event_key) FROM stdin;
\.


--
-- Data for Name: crm_flow_logs; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_flow_logs (id, flow_id, step_id, contact_id, trigger_event, status, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: crm_flow_step_queue; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_flow_step_queue (id, flow_id, contact_id, resume_step_order, run_at, attempts, max_attempts, last_error, event_data, locked_at, locked_by, finished_at, created_at) FROM stdin;
\.


--
-- Data for Name: crm_flow_steps; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_flow_steps (id, flow_id, step_order, action_type, action_config, created_at) FROM stdin;
\.


--
-- Data for Name: crm_flows; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_flows (id, name, trigger_type, trigger_config, is_active, cron_job_name, last_fired_at, created_at, updated_at, goal_id) FROM stdin;
35491305-d0cf-4063-b6d1-deddba73068e	Welcome Email	contact.subscribed	{}	f	\N	\N	2026-09-18 16:29:11.620243+00	2026-09-18 16:29:11.620243+00	\N
\.


--
-- Data for Name: crm_goal_actions; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_goal_actions (id, goal_id, action_type, target_table, target_id, status, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: crm_goal_contacts; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_goal_contacts (id, goal_id, contact_id, status, conversation_state, matched_at, last_touched_at, converted_at, conversion_reason, messages_sent, replies_received, insights, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_goal_runs; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_goal_runs (id, goal_id, run_type, status, selection_stats, processing_stats, metadata, error, started_at, completed_at, created_at) FROM stdin;
\.


--
-- Data for Name: crm_goal_work; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_goal_work (id, goal_id, kind, payload, status, not_before, attempts, max_attempts, last_error, locked_at, locked_by, finished_at, created_at) FROM stdin;
\.


--
-- Data for Name: crm_goals; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_goals (id, objective_text, status, category, tags, config, success_criteria, plan, rules, instructions, sender, created_by, last_run_at, last_processed_at, last_contact_match_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_lists; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_lists (id, name, description, filter_query, is_dynamic, created_at, goal_id) FROM stdin;
\.


--
-- Data for Name: crm_sends; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".crm_sends (id, goal_id, campaign_id, flow_id, contact_id, direction, source, created_by, status, to_email, from_email, subject, body, draft_body, approved_by, approved_at, mailgun_message_id, in_reply_to, thread_references, idempotency_key, error, metadata, sent_at, locked_at, locked_by, attempts, max_attempts, created_at, updated_at, channel, to_phone, from_name, body_html, scheduled_at) FROM stdin;
\.


--
-- Data for Name: faqs; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".faqs (id, question, answer, sort_order, is_published, created_at) FROM stdin;
1	How fast do you actually arrive?	Dispatch answers 24/7 and a mechanic is usually rolling within 30 minutes of your call. Average arrival along the Highway 2 corridor is about 45 minutes, and you get a live ETA by text as soon as the truck leaves. If we are further out than that, you hear the real number on the phone instead of a guess.	1	t	2026-09-18 16:35:55.967725+00
2	What areas do you cover?	The Saint John River valley and the Trans-Canada Highway 2 corridor: Edmundston, Grand Falls, Saint-Léonard, Saint-Quentin and everything in between — roadside or in your yard. Sitting just outside that stretch? Call anyway and we will tell you straight away whether we can reach you.	2	t	2026-09-18 16:35:55.967725+00
7	What if the repair cannot be done roadside?	Most calls end with the truck driving away. When a repair genuinely needs a shop — a major engine or transmission failure — we tell you on the spot instead of billing hours against a job that cannot finish, and we help arrange the tow and hand over the diagnosis so nobody starts from scratch.	7	t	2026-09-18 16:35:55.967725+00
8	Do your trucks carry parts?	Our service trucks are stocked for the failures we see most: filters, belts, hoses, air line fittings, lamps, batteries and tire service. Anything we do not carry, we source and bring out — you are not phoning parts counters from the shoulder of the highway.	8	t	2026-09-18 16:35:55.967725+00
4	What payment methods do you accept?	Payment is settled on site once the truck is moving again, and you get an itemised digital invoice by email covering labour and parts. Roadside we take debit and all major credit cards on the mechanic’s card reader, plus Interac e-Transfer and cash — nobody has to go hunting for a bank machine at 3am. Company cheques are accepted from established account holders. Fleet accounts are handled separately — see below.	4	t	2026-09-18 16:35:55.967725+00
6	How are fleet accounts billed?	Fleets from 3 to 300 trucks run on a single account: one phone number, one invoice covering every unit, and full digital service records per truck so your compliance file stays current. Approved accounts skip roadside payment and are invoiced once a month instead — every call on one statement, itemised by unit and work order, payable within 30 days by e-Transfer, cheque or card. We can quote your purchase-order number on the invoice, and the account is opened over the phone before the first call so there is no paperwork at 2am.	6	t	2026-09-18 16:35:55.967725+00
3	Do you come out in winter conditions?	Yes — winter is our busiest season. Our service trucks carry lighting, heat and cold-weather gear, so −30, freezing rain and snowbanks are normal working conditions, not a reason to wait until morning. We also run cold-weather readiness checks every fall so fewer trucks need that 3am call.	3	t	2026-09-18 16:35:55.967725+00
5	Do you service reefers after hours?	Yes — reefer calls run on the same 24/7 dispatch as everything else. A dead refrigeration unit is a load on a clock, so those calls are treated as emergencies: we diagnose on the shoulder or in your yard and get the box back down to temperature before the freight is written off.	5	t	2026-09-18 16:35:55.967725+00
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".password_reset_tokens (id, user_id, email, token_hash, scope, created_by, created_at, expires_at, used_at, attempts) FROM stdin;
1	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	tmp-reset-1789760186725@example.com	5d91d5aa69bcdad365a6eda537ed91f7c0f561538751905cc3a75662dc47a2ca	customer	\N	2026-09-18 19:36:28.431396+00	2026-09-18 18:06:28.421+00	\N	1
2	67d29c4c-f0ed-409c-99f7-7871bcd5a1d8	nobody-1789760186725@example.com	0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a	customer	\N	2026-09-18 19:36:29.353427+00	2026-09-18 20:36:29.345+00	\N	0
3	c776afe6-9704-4418-b4ea-338a68f7a0b9	tmp-reset-1789760209802@example.com	8abc1dd0432d9543d9a1a0b1b56592ab363fb08c2c6012567a7d2e27212e95c9	customer	\N	2026-09-18 19:36:51.555358+00	2026-09-18 18:06:51.544+00	\N	0
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".profiles (id, email, full_name, role, is_active, created_at, password_hash, password_updated_at) FROM stdin;
424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	Uminder Singh	admin	t	2026-09-18 17:47:38.156173+00	$2a$10$ZzgY2CZ5JH8xghz3......eUYupIUMJ.eCyMyLL/U/WnBh3fXtl4K	2026-09-18 20:08:15.934274+00
a8bc0ead-21e7-402c-bb3f-f0d52350a9de	testadmin@gmail.com	testadmin	admin	t	2026-09-18 20:11:16.510121+00	$2a$10$WTtyn9wzhB4wil/O......vHaW2vCGK/aLFAivOHgRXjk1IltkfI6	2026-09-18 20:11:16.851893+00
464d8390-555a-41cd-944a-435f339a35b9	ramsharma@gmail.com	ram sharma	customer	t	2026-09-18 19:50:39.27407+00	$2a$10$XoQcOlgJtCgBQA7Y......IoCk5e1HmbvJ1Ie6GTimWzoCyuHsX7i	2026-09-18 19:50:39.494+00
\.


--
-- Data for Name: rate_limits; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".rate_limits (key, window_start, count) FROM stdin;
reset-create:424beae5-1082-4eb2-bc0c-74403dca19db	2026-09-18 20:03:07.76185+00	1
reset-token:0934618d42fcc941a366ffd05485f1f8839405b46a2458487c2fef1c92a79470	2026-09-18 20:03:09.726244+00	1
reset-redeem:0934618d42fcc941a366ffd05485f1f8839405b46a2458487c2fef1c92a79470	2026-09-18 20:03:09.98522+00	2
customer-register:bdd737f16087125d32e1e176cd68c13f9e058b4fb619bb91654b495a7b121085	2026-09-18 20:03:04.32832+00	2
login-ip:bdd737f16087125d32e1e176cd68c13f9e058b4fb619bb91654b495a7b121085	2026-09-18 20:03:04.777682+00	13
login-ip:e689e581efb6d69d1edc65d859fadd7c2d94327db075f190f8af5f0ad44a42ff	2026-09-18 20:03:17.201934+00	1
reset-token:1f6d1ddacbab934c59fc196c6c833b8da1300dedeb66d13ecff4628b15c08209	2026-09-18 20:03:31.016203+00	1
reset-redeem:1f6d1ddacbab934c59fc196c6c833b8da1300dedeb66d13ecff4628b15c08209	2026-09-18 20:03:31.439267+00	2
pwchange:424beae5-1082-4eb2-bc0c-74403dca19db	2026-09-18 20:08:15.527031+00	1
staff-register:47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	2026-09-18 20:11:16.207533+00	1
login-ip:47b03a9f1ad85d4657d062313bdb445cae88c4176141249509ae21fea7911f6c	2026-09-18 20:05:39.085307+00	7
staff-register:bdd737f16087125d32e1e176cd68c13f9e058b4fb619bb91654b495a7b121085	2026-09-18 20:03:05.996322+00	1
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".reviews (id, author, rating, text, is_published, sort_order, created_at) FROM stdin;
1	Owner-operator · Edmundston	5	Blew a tire outside Grand Falls at 2am. They were there in forty minutes.	t	1	2026-09-18 16:35:55.967725+00
2	Fleet manager · Grand Falls	5	Our whole fleet gets serviced in our yard now. Zero downtime.	t	2	2026-09-18 16:35:55.967725+00
3	Long-haul driver · Hwy 2	5	Reefer died in −28. Fixed on the shoulder, load saved.	t	3	2026-09-18 16:35:55.967725+00
\.


--
-- Data for Name: road_notes; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".road_notes (id, title, body, category, read_minutes, is_published, published_at, sort_order, created_at) FROM stdin;
2	Cold-start checklist for the first −20° night.		Battery	4	t	2026-09-18 16:35:55.967725+00	2	2026-09-18 16:35:55.967725+00
3	Three sounds your reefer makes before it fails.		Reefer	5	t	2026-09-18 16:35:55.967725+00	3	2026-09-18 16:35:55.967725+00
1	Why diesel gels at −25° and how TO stop it.		Winter	6	t	2026-09-18 20:06:35.866+00	1	2026-09-18 16:35:55.967725+00
\.


--
-- Data for Name: service_requests; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".service_requests (id, name, phone, email, location, truck_details, issue_description, urgency, status, assigned_to, internal_notes, ip_hash, created_at, updated_at, user_id) FROM stdin;
\.


--
-- Data for Name: site_content; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".site_content (key, type, value, label, section, sort_order, updated_at, updated_by) FROM stdin;
hero_eyebrow	text	// 24/7 · Northern New Brunswick	Hero eyebrow	Hero	10	2026-09-18 18:16:32.453885+00	\N
hero_line1	text	Truck trouble doesn't wait.	Headline — line 1	Hero	20	2026-09-18 18:16:32.453885+00	\N
hero_line2	text	Neither do we.	Headline — line 2 (amber)	Hero	30	2026-09-18 18:16:32.453885+00	\N
hero_sub	richtext	24/7 mobile heavy-duty truck & trailer repair. Certified mechanics dispatched TO your location — no tow, no shop wait.	Sub-headline	Hero	40	2026-09-18 18:16:32.453885+00	\N
hero_cta_primary	text	Call BTown now	Primary button label	Hero	50	2026-09-18 18:16:32.453885+00	\N
hero_cta_secondary	text	How it works	Secondary button label	Hero	60	2026-09-18 18:16:32.453885+00	\N
hero_platform_label	text	Dispatched from Edmundston	Caption under the hero art	Hero	70	2026-09-18 18:16:32.453885+00	\N
services_title	text	What we fix.	Section title	Services	10	2026-09-18 18:16:32.453885+00	\N
services_sub	text	Almost everything that stops a truck.	Section intro	Services	20	2026-09-18 18:16:32.453885+00	\N
service_engine_title	text	Engine	Card 1 — title	Services	30	2026-09-18 18:16:32.453885+00	\N
service_engine_desc	text	Mobile truck & trailer repair	Card 1 — description	Services	31	2026-09-18 18:16:32.453885+00	\N
service_diesel_title	text	Diesel	Card 2 — title	Services	40	2026-09-18 18:16:32.453885+00	\N
service_diesel_desc	text	Diagnostics & fuel systems	Card 2 — description	Services	41	2026-09-18 18:16:32.453885+00	\N
service_tire_title	text	Tires	Card 3 — title	Services	50	2026-09-18 18:16:32.453885+00	\N
service_tire_desc	text	Roadside tire service	Card 3 — description	Services	51	2026-09-18 18:16:32.453885+00	\N
service_battery_title	text	Battery	Card 4 — title	Services	60	2026-09-18 18:16:32.453885+00	\N
service_battery_desc	text	Jump start & cold-start	Card 4 — description	Services	61	2026-09-18 18:16:32.453885+00	\N
service_brakes_title	text	Brakes	Card 5 — title	Services	70	2026-09-18 18:16:32.453885+00	\N
service_brakes_desc	text	Brakes & air systems	Card 5 — description	Services	71	2026-09-18 18:16:32.453885+00	\N
service_reefer_title	text	Reefer	Card 6 — title	Services	80	2026-09-18 18:16:32.453885+00	\N
service_reefer_desc	text	Refrigeration units	Card 6 — description	Services	81	2026-09-18 18:16:32.453885+00	\N
service_trailer_title	text	Trailer	Card 7 — title	Services	90	2026-09-18 18:16:32.453885+00	\N
service_trailer_desc	text	Trailer repair	Card 7 — description	Services	91	2026-09-18 18:16:32.453885+00	\N
service_fleet_title	text	Fleet	Card 8 — title	Services	100	2026-09-18 18:16:32.453885+00	\N
service_fleet_desc	text	Scheduled maintenance	Card 8 — description	Services	101	2026-09-18 18:16:32.453885+00	\N
how_title	text	Three steps.	Section title	How it works	10	2026-09-18 18:16:32.453885+00	\N
how_sub	text	From the shoulder of the highway TO back on the road.	Section intro	How it works	20	2026-09-18 18:16:32.453885+00	\N
how_step1_label	text	Call	Step 1 — label	How it works	30	2026-09-18 18:16:32.453885+00	\N
how_step1_line	text	Tell us where you are and what’s wrong	Step 1 — description	How it works	31	2026-09-18 18:16:32.453885+00	\N
how_step2_label	text	We roll	Step 2 — label	How it works	40	2026-09-18 18:16:32.453885+00	\N
how_step2_line	text	A certified mechanic is dispatched; you get an ETA by text	Step 2 — description	How it works	41	2026-09-18 18:16:32.453885+00	\N
how_step3_label	text	Fixed	Step 3 — label	How it works	50	2026-09-18 18:16:32.453885+00	\N
how_step3_line	text	Repaired roadside or in your yard — you’re moving again	Step 3 — description	How it works	51	2026-09-18 18:16:32.453885+00	\N
fleets_title	text	Parked trucks earn nothing.	Section title	Fleets	10	2026-09-18 18:16:32.453885+00	\N
fleets_body	richtext	Scheduled on-site maintenance and priority dispatch for fleets of 3 to 300 — one number, one invoice, full digital service records.	Section body	Fleets	20	2026-09-18 18:16:32.453885+00	\N
fleets_cta	text	Book a fleet visit	Button label	Fleets	30	2026-09-18 18:16:32.453885+00	\N
fleets_caption	text	Yard service · Edmundston TO Saint-Quentin	Caption under the yard illustration	Fleets	40	2026-09-18 18:16:32.453885+00	\N
coverage_title	text	Northern NB, covered.	Section title	Coverage	10	2026-09-18 18:16:32.453885+00	\N
coverage_body	richtext	Dispatched across the Saint John River valley and the Trans-Canada Highway 2 corridor.	Section body	Coverage	20	2026-09-18 18:16:32.453885+00	\N
coverage_towns	text	Edmundston, Grand Falls, Saint-Léonard, Saint-Quentin, Hwy 2	Town list (comma separated)	Coverage	30	2026-09-18 18:16:32.453885+00	\N
coverage_cta	text	Check my location	Button label	Coverage	40	2026-09-18 18:16:32.453885+00	\N
contact_title	text	Need us now?	Section title	Contact	10	2026-09-18 18:16:32.453885+00	\N
contact_body	richtext	Same number, day or night.	Section body	Contact	20	2026-09-18 18:16:32.453885+00	\N
contact_phone	text	506-223-1121	24/7 phone number (used everywhere on the site)	Contact	30	2026-09-18 18:16:32.453885+00	\N
contact_email	text		Business email — shown in the contact section only when filled in	Contact	40	2026-09-18 18:16:32.453885+00	\N
contact_service_area	text	Edmundston · Grand Falls · Saint-Léonard · Saint-Quentin · Hwy 2	Service area line	Contact	50	2026-09-18 18:16:32.453885+00	\N
footer_tagline	richtext	24/7 mobile heavy-duty truck & trailer repair across Northern New Brunswick.	Footer tagline	Footer	10	2026-09-18 18:16:32.453885+00	\N
hero_image	image		Hero image — replaces the built-in truck illustration when set	Images	10	2026-09-18 18:16:32.453885+00	\N
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".system_settings (key, value, updated_at) FROM stdin;
email_delivery	{"available": false}	2026-09-18 19:15:47.732256+00
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh; Owner: -
--

COPY "prj_-jPU4p7xAmeh".user_roles (user_id, role, granted_at, granted_by) FROM stdin;
424beae5-1082-4eb2-bc0c-74403dca19db	admin	2026-09-18 19:50:39.65761+00	\N
464d8390-555a-41cd-944a-435f339a35b9	customer	2026-09-18 19:50:39.65761+00	\N
424beae5-1082-4eb2-bc0c-74403dca19db	customer	2026-09-18 20:01:00.944661+00	424beae5-1082-4eb2-bc0c-74403dca19db
a8bc0ead-21e7-402c-bb3f-f0d52350a9de	admin	2026-09-18 20:12:26.25658+00	424beae5-1082-4eb2-bc0c-74403dca19db
a8bc0ead-21e7-402c-bb3f-f0d52350a9de	customer	2026-09-18 20:13:32.876752+00	424beae5-1082-4eb2-bc0c-74403dca19db
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

COPY "prj_-jPU4p7xAmeh_auth".identities (id, user_id, provider, identity_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

COPY "prj_-jPU4p7xAmeh_auth".users (id, email, encrypted_password, email_confirmed_at, phone, created_at, updated_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_anonymous, phone_confirmed_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at) FROM stdin;
464d8390-555a-41cd-944a-435f339a35b9	ramsharma@gmail.com	$2a$10$qt7lZXvpukIX2XQFig6Nu.angzHAAVCRO2dTUoTei0LIOE4rEt62y	2026-09-18 19:50:39.147+00	\N	2026-09-18 19:50:39.147+00	2026-09-18 20:00:30.127+00	2026-09-18 20:00:30.127+00	{"provider": "email", "providers": ["email"]}	{"full_name": "ram sharma"}	f	\N	\N	\N	\N	\N
e477570e-002d-4c27-ba10-14280e133e02	probe.nonadmin.7f3a@example.com	$2a$10$xeLGHEIdEgbi98elicCiI.xrUvAsfVoprq.4s/tGq77bshWfrRi32	2026-09-18 20:01:03.272+00	\N	2026-09-18 20:01:03.272+00	2026-09-18 20:03:12.53+00	2026-09-18 20:03:12.53+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Probe Nonadmin"}	f	\N	\N	\N	\N	\N
dfe185f7-026a-43b5-9305-f8946e5c9613	probe.lockout.7f3a@example.com	$2a$10$LphbZH6dz.u/Mw/bcQp5quKWvGdRTv9BGCo.wVWb4pstzWHRClE1a	2026-09-18 20:01:14.352+00	\N	2026-09-18 20:01:14.352+00	2026-09-18 20:01:14.352+00	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Probe Lockout"}	f	\N	\N	\N	\N	\N
cdc14cf6-90f6-4b86-8389-da3e0a06266f	verify.probe.one@example.com	$2a$10$7P1HKAC/fzCkQLdFGbf7E.Kp3JfEBph5vGEtbMNUFxIjL2vYA.3fK	2026-09-18 19:23:22.988+00	\N	2026-09-18 19:23:22.988+00	2026-09-18 19:24:46.447+00	2026-09-18 19:24:46.447+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Verify Probe One", "signup_door": "customer"}	f	\N	\N	\N	\N	\N
932a2a90-2f85-43a0-9949-2dc879500c62	verify.probe.four.b7d2@example.com	$2a$10$sM5dg/ASyogxSSfb9jG1COEIdtJaD6v/gWIsYGj1T4bwjypFWVwEW	2026-09-18 19:27:38.429+00	\N	2026-09-18 19:27:38.429+00	2026-09-18 19:27:38.429+00	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Verify Probe Four", "signup_door": "customer"}	f	\N	\N	\N	\N	\N
a8bc0ead-21e7-402c-bb3f-f0d52350a9de	testadmin@gmail.com	$2a$10$2eS2A6ailfkvzJB8WGuVZ.7b.aPifgA8psfd0cFgSr.YojVwXcDNC	2026-09-18 20:11:16.378+00	\N	2026-09-18 20:11:16.378+00	2026-09-18 20:11:16.378+00	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "testadmin"}	f	\N	\N	\N	\N	\N
424beae5-1082-4eb2-bc0c-74403dca19db	uminder1313@gmail.com	$2a$10$jgO8Bl7DVwqxD0R6dkuiqOTUVnkAF/D8FA/HKbcipnwJ46Cj6KPIK	2026-09-18 17:47:37.949+00	\N	2026-09-18 17:47:37.949+00	2026-09-18 20:13:21.093+00	2026-09-18 20:13:21.093+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Uminder Singh"}	f	\N	\N	\N	\N	\N
685440a1-81e0-41dc-8a1d-49d6306a2b62	probe.lock2.7f3a@example.com	$2a$10$Ym46kaqC5NiLtL.A09RRWuZnPXK2Qvio16Y.3g6WXkB4Hwb1.S796	2026-09-18 20:02:13.021+00	\N	2026-09-18 20:02:13.021+00	2026-09-18 20:02:13.021+00	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Probe Lockout"}	f	\N	\N	\N	\N	\N
91e0db3a-6081-4bad-bc07-eda044a477bb	newuser@gmail.com	$2a$10$wbm8/vL3ojHxoY1QGeyNI.e4MUxkk0bFHsg1ffR25TcpWuvIIc1ki	2026-09-18 19:39:45.176+00	\N	2026-09-18 19:39:45.176+00	2026-09-18 19:40:19.283+00	2026-09-18 19:40:19.283+00	{}	{}	f	\N	\N	\N	\N	\N
2d68ec61-fac8-4e19-8fa6-7d1b19ffcac6	probe.customer.2@example.com	$2a$10$VUg6JezGe1qBz.YZvpxdKeb11pHChspWotTd8uxmX.bjI7pkvv0ni	2026-09-18 19:47:55.985+00	\N	2026-09-18 19:47:55.985+00	2026-09-18 19:47:55.985+00	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Probe Customer"}	f	\N	\N	\N	\N	\N
2096e9e3-ec91-4afc-af2f-45d44dd6d854	probe.customer.7f3a@example.com	$2a$10$UXgB2UzIXbnwSPjr5NpGMuhkN4j48cnhlSW6ReubJuRWpNWCub0x2	2026-09-18 20:01:47.68+00	\N	2026-09-18 20:01:47.68+00	2026-09-18 20:02:27.936+00	2026-09-18 20:02:27.936+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Probe Customer"}	f	\N	\N	\N	\N	\N
16e3b7d6-85f2-46bf-8d97-4ab3dd3963c5	probe.alpha.91@example.com	$2a$10$nxmanxuLjByVFa3UItkXi.GasvFbbiLcwbssQz9c.ASAyTJN..TAC	2026-09-18 19:49:48.371+00	\N	2026-09-18 19:49:48.371+00	2026-09-18 19:57:07.291+00	2026-09-18 19:57:07.291+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Probe Alpha"}	f	\N	\N	\N	\N	\N
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

COPY "prj_-jPU4p7xAmeh_storage".buckets (id, name, public, created_at, updated_at, file_size_limit, allowed_mime_types) FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

COPY "prj_-jPU4p7xAmeh_storage".objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, path_tokens, version) FROM stdin;
\.


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: prj_-jPU4p7xAmeh; Owner: -
--

SELECT pg_catalog.setval('"prj_-jPU4p7xAmeh".audit_log_id_seq', 389, true);


--
-- Name: auth_sessions_id_seq; Type: SEQUENCE SET; Schema: prj_-jPU4p7xAmeh; Owner: -
--

SELECT pg_catalog.setval('"prj_-jPU4p7xAmeh".auth_sessions_id_seq', 27, true);


--
-- Name: faqs_id_seq; Type: SEQUENCE SET; Schema: prj_-jPU4p7xAmeh; Owner: -
--

SELECT pg_catalog.setval('"prj_-jPU4p7xAmeh".faqs_id_seq', 8, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: prj_-jPU4p7xAmeh; Owner: -
--

SELECT pg_catalog.setval('"prj_-jPU4p7xAmeh".password_reset_tokens_id_seq', 9, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: prj_-jPU4p7xAmeh; Owner: -
--

SELECT pg_catalog.setval('"prj_-jPU4p7xAmeh".reviews_id_seq', 3, true);


--
-- Name: road_notes_id_seq; Type: SEQUENCE SET; Schema: prj_-jPU4p7xAmeh; Owner: -
--

SELECT pg_catalog.setval('"prj_-jPU4p7xAmeh".road_notes_id_seq', 3, true);


--
-- Name: service_requests_id_seq; Type: SEQUENCE SET; Schema: prj_-jPU4p7xAmeh; Owner: -
--

SELECT pg_catalog.setval('"prj_-jPU4p7xAmeh".service_requests_id_seq', 2, true);


--
-- Name: admin_allowlist admin_allowlist_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".admin_allowlist
    ADD CONSTRAINT admin_allowlist_pkey PRIMARY KEY (email);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_token_hash_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".auth_sessions
    ADD CONSTRAINT auth_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: auth_throttle auth_throttle_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".auth_throttle
    ADD CONSTRAINT auth_throttle_pkey PRIMARY KEY (key);


--
-- Name: crm_appointments crm_appointments_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_appointments
    ADD CONSTRAINT crm_appointments_pkey PRIMARY KEY (id);


--
-- Name: crm_availability crm_availability_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_availability
    ADD CONSTRAINT crm_availability_pkey PRIMARY KEY (id);


--
-- Name: crm_calendar_members crm_calendar_members_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_calendar_members
    ADD CONSTRAINT crm_calendar_members_pkey PRIMARY KEY (id);


--
-- Name: crm_calendars crm_calendars_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_calendars
    ADD CONSTRAINT crm_calendars_pkey PRIMARY KEY (id);


--
-- Name: crm_calendly_connections crm_calendly_connections_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_calendly_connections
    ADD CONSTRAINT crm_calendly_connections_pkey PRIMARY KEY (id);


--
-- Name: crm_campaigns crm_campaigns_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_campaigns
    ADD CONSTRAINT crm_campaigns_pkey PRIMARY KEY (id);


--
-- Name: crm_contact_lists crm_contact_lists_contact_id_list_id_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_contact_lists
    ADD CONSTRAINT crm_contact_lists_contact_id_list_id_key UNIQUE (contact_id, list_id);


--
-- Name: crm_contact_lists crm_contact_lists_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_contact_lists
    ADD CONSTRAINT crm_contact_lists_pkey PRIMARY KEY (id);


--
-- Name: crm_contacts crm_contacts_email_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_contacts
    ADD CONSTRAINT crm_contacts_email_key UNIQUE (email);


--
-- Name: crm_contacts crm_contacts_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_contacts
    ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_events crm_events_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_events
    ADD CONSTRAINT crm_events_pkey PRIMARY KEY (id);


--
-- Name: crm_flow_logs crm_flow_logs_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_logs
    ADD CONSTRAINT crm_flow_logs_pkey PRIMARY KEY (id);


--
-- Name: crm_flow_step_queue crm_flow_step_queue_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_step_queue
    ADD CONSTRAINT crm_flow_step_queue_pkey PRIMARY KEY (id);


--
-- Name: crm_flow_steps crm_flow_steps_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_steps
    ADD CONSTRAINT crm_flow_steps_pkey PRIMARY KEY (id);


--
-- Name: crm_flows crm_flows_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flows
    ADD CONSTRAINT crm_flows_pkey PRIMARY KEY (id);


--
-- Name: crm_goal_actions crm_goal_actions_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_actions
    ADD CONSTRAINT crm_goal_actions_pkey PRIMARY KEY (id);


--
-- Name: crm_goal_contacts crm_goal_contacts_goal_id_contact_id_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_contacts
    ADD CONSTRAINT crm_goal_contacts_goal_id_contact_id_key UNIQUE (goal_id, contact_id);


--
-- Name: crm_goal_contacts crm_goal_contacts_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_contacts
    ADD CONSTRAINT crm_goal_contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_goal_runs crm_goal_runs_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_runs
    ADD CONSTRAINT crm_goal_runs_pkey PRIMARY KEY (id);


--
-- Name: crm_goal_work crm_goal_work_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_work
    ADD CONSTRAINT crm_goal_work_pkey PRIMARY KEY (id);


--
-- Name: crm_goals crm_goals_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goals
    ADD CONSTRAINT crm_goals_pkey PRIMARY KEY (id);


--
-- Name: crm_lists crm_lists_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_lists
    ADD CONSTRAINT crm_lists_pkey PRIMARY KEY (id);


--
-- Name: crm_sends crm_sends_idempotency_key_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_sends
    ADD CONSTRAINT crm_sends_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: crm_sends crm_sends_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_sends
    ADD CONSTRAINT crm_sends_pkey PRIMARY KEY (id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: road_notes road_notes_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".road_notes
    ADD CONSTRAINT road_notes_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: site_content site_content_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".site_content
    ADD CONSTRAINT site_content_pkey PRIMARY KEY (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_auth".identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_auth".users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_auth".users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_name_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_storage".buckets
    ADD CONSTRAINT buckets_name_key UNIQUE (name);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_storage".buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_bucket_id_name_key; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_storage".objects
    ADD CONSTRAINT objects_bucket_id_name_key UNIQUE (bucket_id, name);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_storage".objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: audit_log_created_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX audit_log_created_idx ON "prj_-jPU4p7xAmeh".audit_log USING btree (created_at DESC);


--
-- Name: auth_sessions_expires_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX auth_sessions_expires_idx ON "prj_-jPU4p7xAmeh".auth_sessions USING btree (expires_at);


--
-- Name: auth_sessions_user_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX auth_sessions_user_idx ON "prj_-jPU4p7xAmeh".auth_sessions USING btree (user_id);


--
-- Name: crm_calendar_members_calendar_user_unique; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE UNIQUE INDEX crm_calendar_members_calendar_user_unique ON "prj_-jPU4p7xAmeh".crm_calendar_members USING btree (calendar_id, user_id);


--
-- Name: crm_calendars_slug_unique; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE UNIQUE INDEX crm_calendars_slug_unique ON "prj_-jPU4p7xAmeh".crm_calendars USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: crm_calendly_connections_user_uri_unique; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE UNIQUE INDEX crm_calendly_connections_user_uri_unique ON "prj_-jPU4p7xAmeh".crm_calendly_connections USING btree (user_id, calendly_user_uri);


--
-- Name: crm_events_channel_event_type_created_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX crm_events_channel_event_type_created_idx ON "prj_-jPU4p7xAmeh".crm_events USING btree (channel, event_type, created_at DESC);


--
-- Name: crm_events_contact_channel_event_type_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX crm_events_contact_channel_event_type_idx ON "prj_-jPU4p7xAmeh".crm_events USING btree (contact_id, channel, event_type);


--
-- Name: idx_crm_appointments_assigned_user_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_appointments_assigned_user_id ON "prj_-jPU4p7xAmeh".crm_appointments USING btree (assigned_user_id);


--
-- Name: idx_crm_appointments_calendar_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_appointments_calendar_id ON "prj_-jPU4p7xAmeh".crm_appointments USING btree (calendar_id);


--
-- Name: idx_crm_appointments_contact_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_appointments_contact_id ON "prj_-jPU4p7xAmeh".crm_appointments USING btree (contact_id);


--
-- Name: idx_crm_appointments_starts_at; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_appointments_starts_at ON "prj_-jPU4p7xAmeh".crm_appointments USING btree (starts_at);


--
-- Name: idx_crm_appointments_status; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_appointments_status ON "prj_-jPU4p7xAmeh".crm_appointments USING btree (status);


--
-- Name: idx_crm_availability_calendar_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_availability_calendar_id ON "prj_-jPU4p7xAmeh".crm_availability USING btree (calendar_id);


--
-- Name: idx_crm_calendar_members_calendar_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_calendar_members_calendar_id ON "prj_-jPU4p7xAmeh".crm_calendar_members USING btree (calendar_id);


--
-- Name: idx_crm_calendar_members_user_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_calendar_members_user_id ON "prj_-jPU4p7xAmeh".crm_calendar_members USING btree (user_id);


--
-- Name: idx_crm_calendars_calendly_connection; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_calendars_calendly_connection ON "prj_-jPU4p7xAmeh".crm_calendars USING btree (calendly_connection_id) WHERE (calendly_connection_id IS NOT NULL);


--
-- Name: idx_crm_calendars_is_active; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_calendars_is_active ON "prj_-jPU4p7xAmeh".crm_calendars USING btree (is_active);


--
-- Name: idx_crm_calendars_owner_user_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_calendars_owner_user_id ON "prj_-jPU4p7xAmeh".crm_calendars USING btree (owner_user_id);


--
-- Name: idx_crm_calendly_connections_user_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_calendly_connections_user_id ON "prj_-jPU4p7xAmeh".crm_calendly_connections USING btree (user_id);


--
-- Name: idx_crm_campaigns_created_at; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_campaigns_created_at ON "prj_-jPU4p7xAmeh".crm_campaigns USING btree (created_at);


--
-- Name: idx_crm_campaigns_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_campaigns_goal_id ON "prj_-jPU4p7xAmeh".crm_campaigns USING btree (goal_id);


--
-- Name: idx_crm_campaigns_status; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_campaigns_status ON "prj_-jPU4p7xAmeh".crm_campaigns USING btree (status);


--
-- Name: idx_crm_contact_lists_contact_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contact_lists_contact_id ON "prj_-jPU4p7xAmeh".crm_contact_lists USING btree (contact_id);


--
-- Name: idx_crm_contact_lists_list_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contact_lists_list_id ON "prj_-jPU4p7xAmeh".crm_contact_lists USING btree (list_id);


--
-- Name: idx_crm_contacts_created_at; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contacts_created_at ON "prj_-jPU4p7xAmeh".crm_contacts USING btree (created_at);


--
-- Name: idx_crm_contacts_email; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE UNIQUE INDEX idx_crm_contacts_email ON "prj_-jPU4p7xAmeh".crm_contacts USING btree (email);


--
-- Name: idx_crm_contacts_purchased_product_ids; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contacts_purchased_product_ids ON "prj_-jPU4p7xAmeh".crm_contacts USING gin (purchased_product_ids);


--
-- Name: idx_crm_contacts_purchased_product_names; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contacts_purchased_product_names ON "prj_-jPU4p7xAmeh".crm_contacts USING gin (purchased_product_names);


--
-- Name: idx_crm_contacts_source; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contacts_source ON "prj_-jPU4p7xAmeh".crm_contacts USING btree (source);


--
-- Name: idx_crm_contacts_subscribed; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contacts_subscribed ON "prj_-jPU4p7xAmeh".crm_contacts USING btree (subscribed);


--
-- Name: idx_crm_contacts_tags; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_contacts_tags ON "prj_-jPU4p7xAmeh".crm_contacts USING gin (tags);


--
-- Name: idx_crm_events_campaign_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_events_campaign_id ON "prj_-jPU4p7xAmeh".crm_events USING btree (campaign_id);


--
-- Name: idx_crm_events_channel; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_events_channel ON "prj_-jPU4p7xAmeh".crm_events USING btree (channel);


--
-- Name: idx_crm_events_contact_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_events_contact_id ON "prj_-jPU4p7xAmeh".crm_events USING btree (contact_id);


--
-- Name: idx_crm_events_created_at; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_events_created_at ON "prj_-jPU4p7xAmeh".crm_events USING btree (created_at);


--
-- Name: idx_crm_events_event_key; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE UNIQUE INDEX idx_crm_events_event_key ON "prj_-jPU4p7xAmeh".crm_events USING btree (event_key) WHERE (event_key IS NOT NULL);


--
-- Name: idx_crm_events_event_type; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_events_event_type ON "prj_-jPU4p7xAmeh".crm_events USING btree (event_type);


--
-- Name: idx_crm_events_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_events_goal_id ON "prj_-jPU4p7xAmeh".crm_events USING btree (goal_id);


--
-- Name: idx_crm_events_send_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_events_send_id ON "prj_-jPU4p7xAmeh".crm_events USING btree (send_id);


--
-- Name: idx_crm_flow_logs_contact_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flow_logs_contact_id ON "prj_-jPU4p7xAmeh".crm_flow_logs USING btree (contact_id);


--
-- Name: idx_crm_flow_logs_created_at; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flow_logs_created_at ON "prj_-jPU4p7xAmeh".crm_flow_logs USING btree (created_at);


--
-- Name: idx_crm_flow_logs_flow_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flow_logs_flow_id ON "prj_-jPU4p7xAmeh".crm_flow_logs USING btree (flow_id);


--
-- Name: idx_crm_flow_step_queue_due; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flow_step_queue_due ON "prj_-jPU4p7xAmeh".crm_flow_step_queue USING btree (run_at) WHERE ((finished_at IS NULL) AND (attempts < max_attempts));


--
-- Name: idx_crm_flow_steps_flow_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flow_steps_flow_id ON "prj_-jPU4p7xAmeh".crm_flow_steps USING btree (flow_id);


--
-- Name: idx_crm_flows_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flows_goal_id ON "prj_-jPU4p7xAmeh".crm_flows USING btree (goal_id);


--
-- Name: idx_crm_flows_is_active; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flows_is_active ON "prj_-jPU4p7xAmeh".crm_flows USING btree (is_active);


--
-- Name: idx_crm_flows_trigger_type; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_flows_trigger_type ON "prj_-jPU4p7xAmeh".crm_flows USING btree (trigger_type);


--
-- Name: idx_crm_goal_actions_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_goal_actions_goal_id ON "prj_-jPU4p7xAmeh".crm_goal_actions USING btree (goal_id);


--
-- Name: idx_crm_goal_contacts_contact_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_goal_contacts_contact_id ON "prj_-jPU4p7xAmeh".crm_goal_contacts USING btree (contact_id);


--
-- Name: idx_crm_goal_contacts_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_goal_contacts_goal_id ON "prj_-jPU4p7xAmeh".crm_goal_contacts USING btree (goal_id);


--
-- Name: idx_crm_goal_contacts_status; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_goal_contacts_status ON "prj_-jPU4p7xAmeh".crm_goal_contacts USING btree (status);


--
-- Name: idx_crm_goal_runs_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_goal_runs_goal_id ON "prj_-jPU4p7xAmeh".crm_goal_runs USING btree (goal_id);


--
-- Name: idx_crm_goal_work_due; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_goal_work_due ON "prj_-jPU4p7xAmeh".crm_goal_work USING btree (not_before) WHERE ((finished_at IS NULL) AND (attempts < max_attempts));


--
-- Name: idx_crm_goals_status; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_goals_status ON "prj_-jPU4p7xAmeh".crm_goals USING btree (status);


--
-- Name: idx_crm_lists_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_lists_goal_id ON "prj_-jPU4p7xAmeh".crm_lists USING btree (goal_id);


--
-- Name: idx_crm_sends_campaign_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_sends_campaign_id ON "prj_-jPU4p7xAmeh".crm_sends USING btree (campaign_id);


--
-- Name: idx_crm_sends_contact_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_sends_contact_id ON "prj_-jPU4p7xAmeh".crm_sends USING btree (contact_id);


--
-- Name: idx_crm_sends_goal_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_sends_goal_id ON "prj_-jPU4p7xAmeh".crm_sends USING btree (goal_id);


--
-- Name: idx_crm_sends_in_reply_to; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_sends_in_reply_to ON "prj_-jPU4p7xAmeh".crm_sends USING btree (in_reply_to);


--
-- Name: idx_crm_sends_mailgun_message_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_sends_mailgun_message_id ON "prj_-jPU4p7xAmeh".crm_sends USING btree (mailgun_message_id);


--
-- Name: idx_crm_sends_status; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX idx_crm_sends_status ON "prj_-jPU4p7xAmeh".crm_sends USING btree (status);


--
-- Name: password_reset_tokens_expiry_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX password_reset_tokens_expiry_idx ON "prj_-jPU4p7xAmeh".password_reset_tokens USING btree (expires_at);


--
-- Name: password_reset_tokens_hash_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX password_reset_tokens_hash_idx ON "prj_-jPU4p7xAmeh".password_reset_tokens USING btree (token_hash);


--
-- Name: password_reset_tokens_user_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX password_reset_tokens_user_idx ON "prj_-jPU4p7xAmeh".password_reset_tokens USING btree (user_id);


--
-- Name: profiles_email_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX profiles_email_idx ON "prj_-jPU4p7xAmeh".profiles USING btree (lower(email));


--
-- Name: service_requests_email_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX service_requests_email_idx ON "prj_-jPU4p7xAmeh".service_requests USING btree (lower(email));


--
-- Name: service_requests_status_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX service_requests_status_idx ON "prj_-jPU4p7xAmeh".service_requests USING btree (status, created_at DESC);


--
-- Name: service_requests_user_id_idx; Type: INDEX; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE INDEX service_requests_user_id_idx ON "prj_-jPU4p7xAmeh".service_requests USING btree (user_id);


--
-- Name: idx_identities_user_id; Type: INDEX; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE INDEX idx_identities_user_id ON "prj_-jPU4p7xAmeh_auth".identities USING btree (user_id);


--
-- Name: faqs audit_faqs; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER audit_faqs AFTER INSERT OR DELETE OR UPDATE ON "prj_-jPU4p7xAmeh".faqs FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_audit();


--
-- Name: profiles audit_profiles; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER audit_profiles AFTER DELETE OR UPDATE ON "prj_-jPU4p7xAmeh".profiles FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_audit();


--
-- Name: reviews audit_reviews; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER audit_reviews AFTER INSERT OR DELETE OR UPDATE ON "prj_-jPU4p7xAmeh".reviews FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_audit();


--
-- Name: road_notes audit_road_notes; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER audit_road_notes AFTER INSERT OR DELETE OR UPDATE ON "prj_-jPU4p7xAmeh".road_notes FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_audit();


--
-- Name: service_requests audit_service_requests; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER audit_service_requests AFTER INSERT OR DELETE OR UPDATE ON "prj_-jPU4p7xAmeh".service_requests FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_audit();


--
-- Name: user_roles audit_user_roles_trg; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER audit_user_roles_trg AFTER INSERT OR DELETE ON "prj_-jPU4p7xAmeh".user_roles FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_audit_user_roles();


--
-- Name: profiles enforce_admin_allowlist_profiles; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER enforce_admin_allowlist_profiles BEFORE INSERT OR UPDATE ON "prj_-jPU4p7xAmeh".profiles FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".enforce_admin_allowlist();


--
-- Name: profiles profile_role_ensure_trg; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER profile_role_ensure_trg AFTER UPDATE ON "prj_-jPU4p7xAmeh".profiles FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_profile_role_ensure();


--
-- Name: profiles seed_profile_roles_after_insert; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER seed_profile_roles_after_insert AFTER INSERT ON "prj_-jPU4p7xAmeh".profiles FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".seed_profile_roles();


--
-- Name: site_content site_content_audit; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER site_content_audit AFTER INSERT OR DELETE OR UPDATE ON "prj_-jPU4p7xAmeh".site_content FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_audit();


--
-- Name: site_content site_content_touch; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER site_content_touch BEFORE UPDATE ON "prj_-jPU4p7xAmeh".site_content FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_touch_updated_at();


--
-- Name: user_roles sync_profile_summary_role_trg; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER sync_profile_summary_role_trg AFTER INSERT OR DELETE OR UPDATE ON "prj_-jPU4p7xAmeh".user_roles FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".sync_profile_summary_role();


--
-- Name: service_requests touch_service_requests; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE TRIGGER touch_service_requests BEFORE UPDATE ON "prj_-jPU4p7xAmeh".service_requests FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".tg_touch_updated_at();


--
-- Name: users on_auth_user_auto_confirm; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE TRIGGER on_auth_user_auto_confirm BEFORE INSERT ON "prj_-jPU4p7xAmeh_auth".users FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".auto_confirm_new_auth_user();


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON "prj_-jPU4p7xAmeh_auth".users FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".handle_new_user_bootstrap();


--
-- Name: users on_auth_user_normalize_bcrypt; Type: TRIGGER; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE TRIGGER on_auth_user_normalize_bcrypt BEFORE INSERT OR UPDATE ON "prj_-jPU4p7xAmeh_auth".users FOR EACH ROW EXECUTE FUNCTION "prj_-jPU4p7xAmeh".normalize_bcrypt_prefix();


--
-- Name: auth_sessions auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES "prj_-jPU4p7xAmeh".profiles(id) ON DELETE CASCADE;


--
-- Name: crm_appointments crm_appointments_calendar_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_appointments
    ADD CONSTRAINT crm_appointments_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES "prj_-jPU4p7xAmeh".crm_calendars(id) ON DELETE CASCADE;


--
-- Name: crm_appointments crm_appointments_contact_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_appointments
    ADD CONSTRAINT crm_appointments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES "prj_-jPU4p7xAmeh".crm_contacts(id) ON DELETE SET NULL;


--
-- Name: crm_availability crm_availability_calendar_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_availability
    ADD CONSTRAINT crm_availability_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES "prj_-jPU4p7xAmeh".crm_calendars(id) ON DELETE CASCADE;


--
-- Name: crm_calendar_members crm_calendar_members_calendar_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_calendar_members
    ADD CONSTRAINT crm_calendar_members_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES "prj_-jPU4p7xAmeh".crm_calendars(id) ON DELETE CASCADE;


--
-- Name: crm_calendars crm_calendars_calendly_connection_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_calendars
    ADD CONSTRAINT crm_calendars_calendly_connection_id_fkey FOREIGN KEY (calendly_connection_id) REFERENCES "prj_-jPU4p7xAmeh".crm_calendly_connections(id) ON DELETE SET NULL;


--
-- Name: crm_campaigns crm_campaigns_list_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_campaigns
    ADD CONSTRAINT crm_campaigns_list_id_fkey FOREIGN KEY (list_id) REFERENCES "prj_-jPU4p7xAmeh".crm_lists(id) ON DELETE SET NULL;


--
-- Name: crm_contact_lists crm_contact_lists_contact_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_contact_lists
    ADD CONSTRAINT crm_contact_lists_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES "prj_-jPU4p7xAmeh".crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_contact_lists crm_contact_lists_list_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_contact_lists
    ADD CONSTRAINT crm_contact_lists_list_id_fkey FOREIGN KEY (list_id) REFERENCES "prj_-jPU4p7xAmeh".crm_lists(id) ON DELETE CASCADE;


--
-- Name: crm_events crm_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_events
    ADD CONSTRAINT crm_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES "prj_-jPU4p7xAmeh".crm_campaigns(id) ON DELETE CASCADE;


--
-- Name: crm_events crm_events_contact_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_events
    ADD CONSTRAINT crm_events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES "prj_-jPU4p7xAmeh".crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_flow_logs crm_flow_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_logs
    ADD CONSTRAINT crm_flow_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES "prj_-jPU4p7xAmeh".crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_flow_logs crm_flow_logs_flow_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_logs
    ADD CONSTRAINT crm_flow_logs_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES "prj_-jPU4p7xAmeh".crm_flows(id) ON DELETE CASCADE;


--
-- Name: crm_flow_logs crm_flow_logs_step_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_logs
    ADD CONSTRAINT crm_flow_logs_step_id_fkey FOREIGN KEY (step_id) REFERENCES "prj_-jPU4p7xAmeh".crm_flow_steps(id) ON DELETE SET NULL;


--
-- Name: crm_flow_step_queue crm_flow_step_queue_contact_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_step_queue
    ADD CONSTRAINT crm_flow_step_queue_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES "prj_-jPU4p7xAmeh".crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_flow_step_queue crm_flow_step_queue_flow_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_step_queue
    ADD CONSTRAINT crm_flow_step_queue_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES "prj_-jPU4p7xAmeh".crm_flows(id) ON DELETE CASCADE;


--
-- Name: crm_flow_steps crm_flow_steps_flow_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_flow_steps
    ADD CONSTRAINT crm_flow_steps_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES "prj_-jPU4p7xAmeh".crm_flows(id) ON DELETE CASCADE;


--
-- Name: crm_goal_actions crm_goal_actions_goal_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_actions
    ADD CONSTRAINT crm_goal_actions_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES "prj_-jPU4p7xAmeh".crm_goals(id) ON DELETE CASCADE;


--
-- Name: crm_goal_contacts crm_goal_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_contacts
    ADD CONSTRAINT crm_goal_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES "prj_-jPU4p7xAmeh".crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_goal_contacts crm_goal_contacts_goal_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_contacts
    ADD CONSTRAINT crm_goal_contacts_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES "prj_-jPU4p7xAmeh".crm_goals(id) ON DELETE CASCADE;


--
-- Name: crm_goal_runs crm_goal_runs_goal_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_runs
    ADD CONSTRAINT crm_goal_runs_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES "prj_-jPU4p7xAmeh".crm_goals(id) ON DELETE CASCADE;


--
-- Name: crm_goal_work crm_goal_work_goal_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_goal_work
    ADD CONSTRAINT crm_goal_work_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES "prj_-jPU4p7xAmeh".crm_goals(id) ON DELETE CASCADE;


--
-- Name: crm_sends crm_sends_campaign_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_sends
    ADD CONSTRAINT crm_sends_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES "prj_-jPU4p7xAmeh".crm_campaigns(id) ON DELETE SET NULL;


--
-- Name: crm_sends crm_sends_contact_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_sends
    ADD CONSTRAINT crm_sends_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES "prj_-jPU4p7xAmeh".crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_sends crm_sends_flow_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_sends
    ADD CONSTRAINT crm_sends_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES "prj_-jPU4p7xAmeh".crm_flows(id) ON DELETE SET NULL;


--
-- Name: crm_sends crm_sends_goal_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".crm_sends
    ADD CONSTRAINT crm_sends_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES "prj_-jPU4p7xAmeh".crm_goals(id) ON DELETE SET NULL;


--
-- Name: service_requests service_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".service_requests
    ADD CONSTRAINT service_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES "prj_-jPU4p7xAmeh".profiles(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh".user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES "prj_-jPU4p7xAmeh".profiles(id) ON DELETE CASCADE;


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_auth".identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES "prj_-jPU4p7xAmeh_auth".users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

ALTER TABLE ONLY "prj_-jPU4p7xAmeh_storage".objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES "prj_-jPU4p7xAmeh_storage".buckets(id) ON DELETE CASCADE;


--
-- Name: crm_appointments CRM appointments deletable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM appointments deletable" ON "prj_-jPU4p7xAmeh".crm_appointments FOR DELETE USING (true);


--
-- Name: crm_appointments CRM appointments insertable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM appointments insertable" ON "prj_-jPU4p7xAmeh".crm_appointments FOR INSERT WITH CHECK (true);


--
-- Name: crm_appointments CRM appointments readable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM appointments readable" ON "prj_-jPU4p7xAmeh".crm_appointments FOR SELECT USING (true);


--
-- Name: crm_appointments CRM appointments updatable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM appointments updatable" ON "prj_-jPU4p7xAmeh".crm_appointments FOR UPDATE USING (true);


--
-- Name: crm_availability CRM availability deletable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM availability deletable" ON "prj_-jPU4p7xAmeh".crm_availability FOR DELETE USING (true);


--
-- Name: crm_availability CRM availability insertable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM availability insertable" ON "prj_-jPU4p7xAmeh".crm_availability FOR INSERT WITH CHECK (true);


--
-- Name: crm_availability CRM availability readable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM availability readable" ON "prj_-jPU4p7xAmeh".crm_availability FOR SELECT USING (true);


--
-- Name: crm_availability CRM availability updatable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM availability updatable" ON "prj_-jPU4p7xAmeh".crm_availability FOR UPDATE USING (true);


--
-- Name: crm_calendar_members CRM calendar members deletable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendar members deletable" ON "prj_-jPU4p7xAmeh".crm_calendar_members FOR DELETE USING (true);


--
-- Name: crm_calendar_members CRM calendar members insertable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendar members insertable" ON "prj_-jPU4p7xAmeh".crm_calendar_members FOR INSERT WITH CHECK (true);


--
-- Name: crm_calendar_members CRM calendar members readable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendar members readable" ON "prj_-jPU4p7xAmeh".crm_calendar_members FOR SELECT USING (true);


--
-- Name: crm_calendar_members CRM calendar members updatable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendar members updatable" ON "prj_-jPU4p7xAmeh".crm_calendar_members FOR UPDATE USING (true);


--
-- Name: crm_calendars CRM calendars deletable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendars deletable" ON "prj_-jPU4p7xAmeh".crm_calendars FOR DELETE USING (true);


--
-- Name: crm_calendars CRM calendars insertable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendars insertable" ON "prj_-jPU4p7xAmeh".crm_calendars FOR INSERT WITH CHECK (true);


--
-- Name: crm_calendars CRM calendars readable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendars readable" ON "prj_-jPU4p7xAmeh".crm_calendars FOR SELECT USING (true);


--
-- Name: crm_calendars CRM calendars updatable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM calendars updatable" ON "prj_-jPU4p7xAmeh".crm_calendars FOR UPDATE USING (true);


--
-- Name: crm_flow_logs CRM flow logs insertable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flow logs insertable" ON "prj_-jPU4p7xAmeh".crm_flow_logs FOR INSERT WITH CHECK (true);


--
-- Name: crm_flow_logs CRM flow logs readable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flow logs readable" ON "prj_-jPU4p7xAmeh".crm_flow_logs FOR SELECT USING (true);


--
-- Name: crm_flow_step_queue CRM flow queue deletable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flow queue deletable" ON "prj_-jPU4p7xAmeh".crm_flow_step_queue FOR DELETE USING (true);


--
-- Name: crm_flow_steps CRM flow steps deletable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flow steps deletable" ON "prj_-jPU4p7xAmeh".crm_flow_steps FOR DELETE USING (true);


--
-- Name: crm_flow_steps CRM flow steps insertable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flow steps insertable" ON "prj_-jPU4p7xAmeh".crm_flow_steps FOR INSERT WITH CHECK (true);


--
-- Name: crm_flow_steps CRM flow steps readable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flow steps readable" ON "prj_-jPU4p7xAmeh".crm_flow_steps FOR SELECT USING (true);


--
-- Name: crm_flow_steps CRM flow steps updatable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flow steps updatable" ON "prj_-jPU4p7xAmeh".crm_flow_steps FOR UPDATE USING (true);


--
-- Name: crm_flows CRM flows deletable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flows deletable" ON "prj_-jPU4p7xAmeh".crm_flows FOR DELETE USING (true);


--
-- Name: crm_flows CRM flows insertable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flows insertable" ON "prj_-jPU4p7xAmeh".crm_flows FOR INSERT WITH CHECK (true);


--
-- Name: crm_flows CRM flows readable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flows readable" ON "prj_-jPU4p7xAmeh".crm_flows FOR SELECT USING (true);


--
-- Name: crm_flows CRM flows updatable; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM flows updatable" ON "prj_-jPU4p7xAmeh".crm_flows FOR UPDATE USING (true);


--
-- Name: crm_goal_actions CRM goal actions all; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM goal actions all" ON "prj_-jPU4p7xAmeh".crm_goal_actions USING (true) WITH CHECK (true);


--
-- Name: crm_goal_contacts CRM goal contacts all; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM goal contacts all" ON "prj_-jPU4p7xAmeh".crm_goal_contacts USING (true) WITH CHECK (true);


--
-- Name: crm_goal_runs CRM goal runs all; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM goal runs all" ON "prj_-jPU4p7xAmeh".crm_goal_runs USING (true) WITH CHECK (true);


--
-- Name: crm_goal_work CRM goal work all; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM goal work all" ON "prj_-jPU4p7xAmeh".crm_goal_work USING (true) WITH CHECK (true);


--
-- Name: crm_goals CRM goals all; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM goals all" ON "prj_-jPU4p7xAmeh".crm_goals USING (true) WITH CHECK (true);


--
-- Name: crm_sends CRM sends all; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "CRM sends all" ON "prj_-jPU4p7xAmeh".crm_sends USING (true) WITH CHECK (true);


--
-- Name: crm_calendly_connections Calendly connections service only; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY "Calendly connections service only" ON "prj_-jPU4p7xAmeh".crm_calendly_connections USING (false) WITH CHECK (false);


--
-- Name: admin_allowlist; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".admin_allowlist ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_allowlist admin_allowlist_admin_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY admin_allowlist_admin_read ON "prj_-jPU4p7xAmeh".admin_allowlist FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: audit_log audit_admin_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY audit_admin_read ON "prj_-jPU4p7xAmeh".audit_log FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: audit_log; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_sessions; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".auth_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_throttle; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".auth_throttle ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_appointments; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_availability; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_calendar_members; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_calendar_members ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_calendars; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_calendars ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_calendly_connections; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_calendly_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_campaigns; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_contact_lists; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_contact_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_contacts; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_events; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_events ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_flow_logs; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_flow_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_flow_step_queue; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_flow_step_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_flow_steps; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_flow_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_flows; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_flows ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_goal_actions; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_goal_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_goal_contacts; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_goal_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_goal_runs; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_goal_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_goal_work; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_goal_work ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_goals; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_lists; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_sends; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".crm_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs faqs_admin_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY faqs_admin_delete ON "prj_-jPU4p7xAmeh".faqs FOR DELETE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: faqs faqs_auth_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY faqs_auth_read ON "prj_-jPU4p7xAmeh".faqs FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ((is_published OR "prj_-jPU4p7xAmeh".is_internal_user()));


--
-- Name: faqs faqs_public_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY faqs_public_read ON "prj_-jPU4p7xAmeh".faqs FOR SELECT TO "prj_-jPU4p7xAmeh_role_anon" USING (is_published);


--
-- Name: faqs faqs_staff_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY faqs_staff_insert ON "prj_-jPU4p7xAmeh".faqs FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: faqs faqs_staff_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY faqs_staff_update ON "prj_-jPU4p7xAmeh".faqs FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_staff()) WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: road_notes notes_admin_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY notes_admin_delete ON "prj_-jPU4p7xAmeh".road_notes FOR DELETE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: road_notes notes_auth_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY notes_auth_read ON "prj_-jPU4p7xAmeh".road_notes FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ((is_published OR "prj_-jPU4p7xAmeh".is_internal_user()));


--
-- Name: road_notes notes_public_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY notes_public_read ON "prj_-jPU4p7xAmeh".road_notes FOR SELECT TO "prj_-jPU4p7xAmeh_role_anon" USING (is_published);


--
-- Name: road_notes notes_staff_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY notes_staff_insert ON "prj_-jPU4p7xAmeh".road_notes FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: road_notes notes_staff_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY notes_staff_update ON "prj_-jPU4p7xAmeh".road_notes FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_staff()) WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens password_reset_tokens_admin_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY password_reset_tokens_admin_delete ON "prj_-jPU4p7xAmeh".password_reset_tokens FOR DELETE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: password_reset_tokens password_reset_tokens_admin_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY password_reset_tokens_admin_insert ON "prj_-jPU4p7xAmeh".password_reset_tokens FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: password_reset_tokens password_reset_tokens_admin_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY password_reset_tokens_admin_read ON "prj_-jPU4p7xAmeh".password_reset_tokens FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: password_reset_tokens password_reset_tokens_admin_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY password_reset_tokens_admin_update ON "prj_-jPU4p7xAmeh".password_reset_tokens FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin()) WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: profiles; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY profiles_admin_insert ON "prj_-jPU4p7xAmeh".profiles FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: profiles profiles_admin_write; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY profiles_admin_write ON "prj_-jPU4p7xAmeh".profiles FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin()) WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: profiles profiles_self_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY profiles_self_read ON "prj_-jPU4p7xAmeh".profiles FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING (((id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid) OR "prj_-jPU4p7xAmeh".is_staff()));


--
-- Name: rate_limits; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews reviews_admin_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY reviews_admin_delete ON "prj_-jPU4p7xAmeh".reviews FOR DELETE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: reviews reviews_auth_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY reviews_auth_read ON "prj_-jPU4p7xAmeh".reviews FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ((is_published OR "prj_-jPU4p7xAmeh".is_internal_user()));


--
-- Name: reviews reviews_public_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY reviews_public_read ON "prj_-jPU4p7xAmeh".reviews FOR SELECT TO "prj_-jPU4p7xAmeh_role_anon" USING (is_published);


--
-- Name: reviews reviews_staff_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY reviews_staff_insert ON "prj_-jPU4p7xAmeh".reviews FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: reviews reviews_staff_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY reviews_staff_update ON "prj_-jPU4p7xAmeh".reviews FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_staff()) WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: road_notes; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".road_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: service_requests; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".service_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: site_content; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".site_content ENABLE ROW LEVEL SECURITY;

--
-- Name: site_content site_content_admin_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY site_content_admin_delete ON "prj_-jPU4p7xAmeh".site_content FOR DELETE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: site_content site_content_admin_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY site_content_admin_insert ON "prj_-jPU4p7xAmeh".site_content FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: site_content site_content_public_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY site_content_public_read ON "prj_-jPU4p7xAmeh".site_content FOR SELECT USING (true);


--
-- Name: site_content site_content_staff_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY site_content_staff_update ON "prj_-jPU4p7xAmeh".site_content FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_staff()) WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: service_requests sr_admin_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY sr_admin_delete ON "prj_-jPU4p7xAmeh".service_requests FOR DELETE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: service_requests sr_customer_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY sr_customer_read ON "prj_-jPU4p7xAmeh".service_requests FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING (((user_id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid) OR ((email IS NOT NULL) AND (lower(email) = "prj_-jPU4p7xAmeh".current_user_email()))));


--
-- Name: service_requests sr_internal_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY sr_internal_read ON "prj_-jPU4p7xAmeh".service_requests FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_internal_user());


--
-- Name: service_requests sr_own_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY sr_own_insert ON "prj_-jPU4p7xAmeh".service_requests FOR INSERT WITH CHECK (("prj_-jPU4p7xAmeh".is_staff() AND (user_id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid)));


--
-- Name: service_requests sr_own_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY sr_own_update ON "prj_-jPU4p7xAmeh".service_requests FOR UPDATE USING (("prj_-jPU4p7xAmeh".is_staff() AND (user_id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid))) WITH CHECK (("prj_-jPU4p7xAmeh".is_staff() AND (user_id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid)));


--
-- Name: service_requests sr_staff_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY sr_staff_update ON "prj_-jPU4p7xAmeh".service_requests FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_staff()) WITH CHECK ("prj_-jPU4p7xAmeh".is_staff());


--
-- Name: system_settings; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings_admin_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY system_settings_admin_insert ON "prj_-jPU4p7xAmeh".system_settings FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: system_settings system_settings_admin_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY system_settings_admin_read ON "prj_-jPU4p7xAmeh".system_settings FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: system_settings system_settings_admin_write; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY system_settings_admin_write ON "prj_-jPU4p7xAmeh".system_settings FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING ("prj_-jPU4p7xAmeh".is_admin()) WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: user_roles; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh".user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_admin_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY user_roles_admin_delete ON "prj_-jPU4p7xAmeh".user_roles FOR DELETE USING ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: user_roles user_roles_admin_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY user_roles_admin_insert ON "prj_-jPU4p7xAmeh".user_roles FOR INSERT WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: user_roles user_roles_admin_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY user_roles_admin_update ON "prj_-jPU4p7xAmeh".user_roles FOR UPDATE USING ("prj_-jPU4p7xAmeh".is_admin()) WITH CHECK ("prj_-jPU4p7xAmeh".is_admin());


--
-- Name: user_roles user_roles_self_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh; Owner: -
--

CREATE POLICY user_roles_self_read ON "prj_-jPU4p7xAmeh".user_roles FOR SELECT USING (((user_id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid) OR "prj_-jPU4p7xAmeh".is_admin()));


--
-- Name: users Admin can delete all users; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Admin can delete all users" ON "prj_-jPU4p7xAmeh_auth".users FOR DELETE TO "prj_-jPU4p7xAmeh_role" USING (true);


--
-- Name: identities Admin can delete identities; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Admin can delete identities" ON "prj_-jPU4p7xAmeh_auth".identities FOR DELETE TO "prj_-jPU4p7xAmeh_role" USING (true);


--
-- Name: users Admin can insert users; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Admin can insert users" ON "prj_-jPU4p7xAmeh_auth".users FOR INSERT TO "prj_-jPU4p7xAmeh_role" WITH CHECK (true);


--
-- Name: users Admin can update all users; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Admin can update all users" ON "prj_-jPU4p7xAmeh_auth".users FOR UPDATE TO "prj_-jPU4p7xAmeh_role" USING (true);


--
-- Name: users Admin can view all users; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Admin can view all users" ON "prj_-jPU4p7xAmeh_auth".users FOR SELECT TO "prj_-jPU4p7xAmeh_role" USING (true);


--
-- Name: identities Users can delete own identities; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can delete own identities" ON "prj_-jPU4p7xAmeh_auth".identities FOR DELETE USING ((user_id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: users Users can delete own profile; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can delete own profile" ON "prj_-jPU4p7xAmeh_auth".users FOR DELETE USING ((id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: identities Users can insert own identities; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can insert own identities" ON "prj_-jPU4p7xAmeh_auth".identities FOR INSERT WITH CHECK ((user_id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: users Users can insert own profile; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can insert own profile" ON "prj_-jPU4p7xAmeh_auth".users FOR INSERT WITH CHECK ((id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: identities Users can update own identities; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can update own identities" ON "prj_-jPU4p7xAmeh_auth".identities FOR UPDATE USING ((user_id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: users Users can update own profile; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can update own profile" ON "prj_-jPU4p7xAmeh_auth".users FOR UPDATE USING ((id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: identities Users can view own identities; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can view own identities" ON "prj_-jPU4p7xAmeh_auth".identities FOR SELECT USING ((user_id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: users Users can view own profile; Type: POLICY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

CREATE POLICY "Users can view own profile" ON "prj_-jPU4p7xAmeh_auth".users FOR SELECT USING ((id = "prj_-jPU4p7xAmeh_auth".auth_uid()));


--
-- Name: identities; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh_auth".identities ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh_auth; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh_auth".users ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets Service role can manage buckets; Type: POLICY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE POLICY "Service role can manage buckets" ON "prj_-jPU4p7xAmeh_storage".buckets USING (true);


--
-- Name: objects Service role can manage objects; Type: POLICY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE POLICY "Service role can manage objects" ON "prj_-jPU4p7xAmeh_storage".objects USING (true);


--
-- Name: buckets; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh_storage".buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

ALTER TABLE "prj_-jPU4p7xAmeh_storage".objects ENABLE ROW LEVEL SECURITY;

--
-- Name: objects site_media_public_read; Type: POLICY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE POLICY site_media_public_read ON "prj_-jPU4p7xAmeh_storage".objects FOR SELECT TO "prj_-jPU4p7xAmeh_role_authenticated", "prj_-jPU4p7xAmeh_role_anon" USING ((bucket_id = 'site-media'::text));


--
-- Name: objects site_media_staff_delete; Type: POLICY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE POLICY site_media_staff_delete ON "prj_-jPU4p7xAmeh_storage".objects FOR DELETE TO "prj_-jPU4p7xAmeh_role_authenticated" USING (((bucket_id = 'site-media'::text) AND (EXISTS ( SELECT 1
   FROM "prj_-jPU4p7xAmeh".profiles p
  WHERE ((p.id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid) AND p.is_active AND (p.role = ANY (ARRAY['admin'::text, 'dispatcher'::text])))))));


--
-- Name: objects site_media_staff_insert; Type: POLICY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE POLICY site_media_staff_insert ON "prj_-jPU4p7xAmeh_storage".objects FOR INSERT TO "prj_-jPU4p7xAmeh_role_authenticated" WITH CHECK (((bucket_id = 'site-media'::text) AND (EXISTS ( SELECT 1
   FROM "prj_-jPU4p7xAmeh".profiles p
  WHERE ((p.id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid) AND p.is_active AND (p.role = ANY (ARRAY['admin'::text, 'dispatcher'::text])))))));


--
-- Name: objects site_media_staff_update; Type: POLICY; Schema: prj_-jPU4p7xAmeh_storage; Owner: -
--

CREATE POLICY site_media_staff_update ON "prj_-jPU4p7xAmeh_storage".objects FOR UPDATE TO "prj_-jPU4p7xAmeh_role_authenticated" USING (((bucket_id = 'site-media'::text) AND (EXISTS ( SELECT 1
   FROM "prj_-jPU4p7xAmeh".profiles p
  WHERE ((p.id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid) AND p.is_active AND (p.role = ANY (ARRAY['admin'::text, 'dispatcher'::text])))))));


--
-- PostgreSQL database dump complete
--


