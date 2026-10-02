-- A team's data as JSON documents, keyed like the app's storage keys (roster, calendar, …).
-- Playbooks are split per play so an editor autosave rewrites one small row.
-- Players never read the coach-only documents: triggers derive what they may see.

create table public.documents (
  workspace_id uuid not null references public.workspaces on delete cascade,
  key text not null,
  value jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- The browser tab that wrote it, so a tab can ignore the echo of its own write.
  client_id text,
  primary key (workspace_id, key),
  constraint documents_size check (pg_column_size(value) < 1500000)
);

-- Keys a coach writes. The derived keys (roster.public, me:…) are written by triggers only.
create function private.writable(k text) returns boolean language sql immutable as $$
  select k in ('roster', 'calendar', 'practice', 'meetings', 'games', 'evaluation', 'videos', 'playbooks.order')
      or k ~ '^(pb|play):[A-Za-z0-9_-]{1,64}$'
$$;

-- Keys every player of the team reads (their own me:… row is allowed separately).
create function private.player_visible(k text) returns boolean language sql immutable as $$
  select k in ('calendar', 'practice', 'meetings', 'games', 'videos', 'roster.public', 'playbooks.order')
      or k like 'pb:%' or k like 'play:%'
$$;

alter table public.documents enable row level security;

create policy documents_read on public.documents for select to authenticated using (
  case private.role_in(workspace_id)
    when 'coach' then true
    when 'player' then private.player_visible(key) or key = 'me:' || private.player_in(workspace_id)
    else false
  end
);
create policy documents_insert on public.documents for insert to authenticated
  with check (private.role_in(workspace_id) = 'coach' and private.writable(key));
create policy documents_update on public.documents for update to authenticated
  using (private.role_in(workspace_id) = 'coach' and private.writable(key))
  with check (private.role_in(workspace_id) = 'coach' and private.writable(key));
create policy documents_delete on public.documents for delete to authenticated
  using (private.role_in(workspace_id) = 'coach' and private.writable(key));

-- Every write bumps the version and records who made it.
create function private.documents_stamp() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger documents_stamp before insert or update on public.documents
  for each row execute function private.documents_stamp();

-- A roster card for teammates: private fields blanked, keys kept so the app's Player type holds.
create function private.public_player(p jsonb) returns jsonb language sql immutable as $$
  select p || jsonb_build_object(
    'phone', '', 'email', '', 'notes', '',
    'birthDate', null, 'heightCm', null, 'weightKg', null, 'injury', null)
$$;

-- Rebuilds what players read: the public roster, and each linked player's own record and evaluation.
create function private.refresh_player_views(ws uuid, only_player text default null, with_public boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  e jsonb;
begin
  select value into r from public.documents where workspace_id = ws and key = 'roster';
  select value into e from public.documents where workspace_id = ws and key = 'evaluation';
  r := coalesce(r, '{"players": [], "depth": {}}');
  e := coalesce(e, '{"criteria": null, "evaluations": [], "tests": []}');

  if with_public then
    insert into public.documents (workspace_id, key, value)
    values (ws, 'roster.public', jsonb_build_object(
      'players', coalesce((
        select jsonb_agg(private.public_player(p) order by i)
        from jsonb_array_elements(r -> 'players') with ordinality t(p, i)), '[]'::jsonb),
      'depth', coalesce(r -> 'depth', '{}'::jsonb)))
    on conflict (workspace_id, key) do update set value = excluded.value
      where public.documents.value is distinct from excluded.value;
  end if;

  insert into public.documents (workspace_id, key, value)
  select ws, 'me:' || m.player_id, jsonb_build_object(
    'player', (
      select p || '{"notes": ""}'::jsonb
      from jsonb_array_elements(r -> 'players') p where p ->> 'id' = m.player_id),
    'evaluation', jsonb_build_object(
      'criteria', e -> 'criteria',
      'evaluations', coalesce((
        select jsonb_agg(x || '{"notes": ""}'::jsonb order by i)
        from jsonb_array_elements(e -> 'evaluations') with ordinality t(x, i)
        where x ->> 'playerId' = m.player_id), '[]'::jsonb),
      'tests', coalesce((
        select jsonb_agg(s || jsonb_build_object('results', jsonb_build_object(m.player_id, s -> 'results' -> m.player_id)) order by i)
        from jsonb_array_elements(e -> 'tests') with ordinality t(s, i)
        where s -> 'results' ? m.player_id), '[]'::jsonb)))
  from public.memberships m
  where m.workspace_id = ws and m.role = 'player' and (only_player is null or m.player_id = only_player)
  on conflict (workspace_id, key) do update set value = excluded.value
    where public.documents.value is distinct from excluded.value;
end $$;
revoke all on function private.refresh_player_views(uuid, text, boolean) from public, anon, authenticated;

-- After each change: refresh the derived rows, then tell the team's browsers which key moved.
-- Only a small signal travels; browsers fetch the row itself, which RLS still guards.
create function private.documents_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := coalesce(new.workspace_id, old.workspace_id);
  k text := coalesce(new.key, old.key);
begin
  if tg_op <> 'DELETE' and k in ('roster', 'evaluation') then
    perform private.refresh_player_views(ws, null, k = 'roster');
  end if;
  perform realtime.send(
    jsonb_build_object(
      'key', k,
      'op', lower(tg_op),
      'version', case when tg_op = 'DELETE' then null else new.version end,
      'client', case when tg_op = 'DELETE' then null else new.client_id end),
    'doc', 'ws:' || ws::text, true);
  return null;
end $$;
create trigger documents_after after insert or update or delete on public.documents
  for each row execute function private.documents_after();

-- Realtime: members may listen on their team's private topic "ws:<id>". Only the database sends.
create function private.topic_ws(t text) returns uuid language sql immutable as $$
  select case when t ~ '^ws:[0-9a-f-]{36}$' then substring(t from 4)::uuid end
$$;
create policy team_members_receive on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast'
  and private.role_in(private.topic_ws((select realtime.topic()))) is not null
);

-- A player removed from the team loses their own row too.
create function private.memberships_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.documents where workspace_id = old.workspace_id and key = 'me:' || old.player_id;
  return null;
end $$;
create trigger memberships_after_delete after delete on public.memberships
  for each row when (old.role = 'player') execute function private.memberships_after_delete();
