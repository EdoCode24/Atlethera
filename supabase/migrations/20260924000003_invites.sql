-- Invite links: one per roster player, single use, valid for 14 days, revocable by the coach.

create table public.invites (
  token text primary key default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
  workspace_id uuid not null references public.workspaces on delete cascade,
  player_id text not null,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
create unique index invites_one_open on public.invites (workspace_id, player_id)
  where used_at is null and revoked_at is null;

alter table public.invites enable row level security;
create policy invites_coach_read on public.invites for select to authenticated
  using (private.role_in(workspace_id) = 'coach');

-- A new link for a roster player; any open link for them is revoked first.
create function public.create_invite(p_ws uuid, p_player text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text;
begin
  if private.role_in(p_ws) is distinct from 'coach' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.documents d, jsonb_array_elements(d.value -> 'players') p
    where d.workspace_id = p_ws and d.key = 'roster' and p ->> 'id' = p_player
  ) then
    raise exception 'player_not_found';
  end if;
  if exists (select 1 from public.memberships where workspace_id = p_ws and player_id = p_player) then
    raise exception 'player_linked';
  end if;
  update public.invites set revoked_at = now()
   where workspace_id = p_ws and player_id = p_player and used_at is null and revoked_at is null;
  insert into public.invites (workspace_id, player_id, created_by) values (p_ws, p_player, auth.uid())
  returning token into t;
  return t;
end $$;

create function public.revoke_invite(p_token text) returns void
language sql security definer set search_path = '' as $$
  update public.invites set revoked_at = now()
   where token = p_token and used_at is null and revoked_at is null and private.role_in(workspace_id) = 'coach'
$$;

-- What the join page shows before sign-in: the team and a short form of the player's name.
create function public.invite_info(p_token text)
returns table (team text, sport text, first_name text, last_initial text, jersey int, status text)
language sql stable security definer set search_path = '' as $$
  select
    w.name,
    w.sport,
    pl.p ->> 'firstName',
    left(pl.p ->> 'lastName', 1),
    (pl.p ->> 'number')::int,
    case
      when i.revoked_at is not null then 'revoked'
      when i.used_by is not null then case when i.used_by = auth.uid() then 'mine' else 'used' end
      when i.expires_at < now() then 'expired'
      else 'open'
    end
  from public.invites i
  join public.workspaces w on w.id = i.workspace_id
  left join public.documents d on d.workspace_id = i.workspace_id and d.key = 'roster'
  left join lateral (
    select x as p from jsonb_array_elements(d.value -> 'players') x where x ->> 'id' = i.player_id
  ) pl on true
  where i.token = p_token
$$;

-- Joins the team as the invited player. Accepting the same link twice is harmless.
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.invites;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v from public.invites where token = p_token for update;
  if not found or v.revoked_at is not null then raise exception 'invite_invalid'; end if;
  if v.used_by = uid then return v.workspace_id; end if;
  if v.used_by is not null then raise exception 'invite_used'; end if;
  if v.expires_at < now() then raise exception 'invite_expired'; end if;
  if exists (select 1 from public.memberships where workspace_id = v.workspace_id and user_id = uid) then
    raise exception 'already_member';
  end if;
  if exists (select 1 from public.memberships where workspace_id = v.workspace_id and player_id = v.player_id) then
    raise exception 'player_taken';
  end if;
  insert into public.memberships (workspace_id, user_id, role, player_id) values (v.workspace_id, uid, 'player', v.player_id);
  update public.invites set used_by = uid, used_at = now() where token = p_token;
  perform private.refresh_player_views(v.workspace_id, v.player_id, false);
  return v.workspace_id;
end $$;

revoke all on function public.create_invite(uuid, text), public.revoke_invite(text), public.accept_invite(text) from public, anon;
grant execute on function public.create_invite(uuid, text), public.revoke_invite(text), public.accept_invite(text) to authenticated;
revoke all on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;

-- The coach's roster shows who has linked: tell the team's browsers when access changes.
create function private.access_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{}'::jsonb, 'access', 'ws:' || coalesce(new.workspace_id, old.workspace_id)::text, true);
  return null;
end $$;
create trigger invites_access after insert or update or delete on public.invites
  for each row execute function private.access_changed();
create trigger memberships_access after insert or update or delete on public.memberships
  for each row execute function private.access_changed();
