create extension if not exists pgcrypto with schema extensions;

create table public.installations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installations_one_per_user unique (user_id)
);

create table public.scan_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (
    status in ('pending', 'processing', 'succeeded', 'partial', 'rejected', 'failed', 'cancelled')
  ),
  provider text,
  model text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  failure_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.generated_recipes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe jsonb not null check (jsonb_typeof(recipe) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint generated_recipes_expiry_after_creation check (expires_at > created_at)
);

create table public.usage_counters (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_date date not null,
  scan_count integer not null default 0 check (scan_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_counters_user_window_unique unique (user_id, window_date)
);

create table public.provider_spend_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  model text not null,
  request_category text not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(12, 8) check (
    estimated_cost_usd is null or estimated_cost_usd >= 0
  ),
  created_at timestamptz not null default now()
);

create index scan_sessions_user_created_idx
  on public.scan_sessions (user_id, created_at desc);
create index generated_recipes_user_created_idx
  on public.generated_recipes (user_id, created_at desc);
create index generated_recipes_expiry_idx
  on public.generated_recipes (expires_at);
create index provider_spend_events_created_idx
  on public.provider_spend_events (created_at desc);
create index provider_spend_events_user_created_idx
  on public.provider_spend_events (user_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger installations_set_updated_at
before update on public.installations
for each row execute function public.set_updated_at();

create trigger scan_sessions_set_updated_at
before update on public.scan_sessions
for each row execute function public.set_updated_at();

create trigger usage_counters_set_updated_at
before update on public.usage_counters
for each row execute function public.set_updated_at();

alter table public.installations enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.generated_recipes enable row level security;
alter table public.usage_counters enable row level security;
alter table public.provider_spend_events enable row level security;

create policy installations_read_own
on public.installations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy generated_recipes_read_own
on public.generated_recipes
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.installations from anon, authenticated;
revoke all on table public.scan_sessions from anon, authenticated;
revoke all on table public.generated_recipes from anon, authenticated;
revoke all on table public.usage_counters from anon, authenticated;
revoke all on table public.provider_spend_events from anon, authenticated;

grant select on table public.installations to authenticated;
grant select on table public.generated_recipes to authenticated;

create function public.reserve_scan_capacity(
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_request_category text,
  p_user_daily_cap integer,
  p_global_daily_cap integer
)
returns table (
  allowed boolean,
  reason text,
  user_scan_count integer,
  global_request_count bigint,
  spend_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_date date := (now() at time zone 'utc')::date;
  v_user_count integer;
  v_global_count bigint;
  v_event_id uuid;
begin
  if p_user_id is null
    or p_user_daily_cap is null
    or p_global_daily_cap is null
    or p_user_daily_cap < 1
    or p_global_daily_cap < 1
    or nullif(btrim(p_provider), '') is null
    or nullif(btrim(p_model), '') is null
    or nullif(btrim(p_request_category), '') is null then
    raise exception 'invalid scan capacity arguments';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('okyo-provider-cap:' || v_window_date::text, 0));

  select count(*)
    into v_global_count
    from public.provider_spend_events
   where created_at >= (v_window_date::timestamp at time zone 'UTC')
     and created_at < ((v_window_date + 1)::timestamp at time zone 'UTC');

  if v_global_count >= p_global_daily_cap then
    return query select false, 'global_daily_cap', 0, v_global_count, null::uuid;
    return;
  end if;

  insert into public.usage_counters (user_id, window_date, scan_count)
  values (p_user_id, v_window_date, 1)
  on conflict (user_id, window_date)
  do update set scan_count = public.usage_counters.scan_count + 1
    where public.usage_counters.scan_count < p_user_daily_cap
  returning scan_count into v_user_count;

  if v_user_count is null then
    select scan_count
      into v_user_count
      from public.usage_counters
     where user_id = p_user_id and window_date = v_window_date;

    return query select false, 'user_daily_cap', v_user_count, v_global_count, null::uuid;
    return;
  end if;

  insert into public.provider_spend_events (
    user_id,
    provider,
    model,
    request_category
  ) values (
    p_user_id,
    btrim(p_provider),
    btrim(p_model),
    btrim(p_request_category)
  )
  returning id into v_event_id;

  return query select true, null::text, v_user_count, v_global_count + 1, v_event_id;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.reserve_scan_capacity(uuid, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_scan_capacity(uuid, text, text, text, integer, integer)
  to service_role;

comment on table public.scan_sessions is
  'Privacy-safe scan lifecycle metadata. Never stores images, prompts, or provider payloads.';
comment on table public.generated_recipes is
  'Normalized generated recipe state isolated by Supabase user ID.';
comment on table public.provider_spend_events is
  'Provider usage and estimated spend metadata without image or provider payload content.';
comment on function public.reserve_scan_capacity(uuid, text, text, text, integer, integer) is
  'Atomically enforces per-user and global daily scan limits and reserves one provider request.';
