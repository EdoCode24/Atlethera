-- Accounts, teams (workspaces) and who belongs to which team in what role.

create schema if not exists private;
grant usage on schema private to authenticated;

create type public.package_id as enum ('pt', 'coach');
create type public.member_role as enum ('coach', 'player');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  -- One workspace per coach account, as in the app today.
  owner_id uuid not null unique references auth.users on delete cascade,
  package public.package_id not null,
  sport text check (sport is null or sport ~ '^[a-z-]+$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.member_role not null,
  -- The roster id ("pl_…") a player account is linked to; coaches have none.
  player_id text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  check ((role = 'player') = (player_id is not null))
);
create unique index memberships_player_once on public.memberships (workspace_id, player_id) where player_id is not null;
create index memberships_user on public.memberships (user_id);

-- The caller's role and roster id in a workspace (null when not a member).
create function private.role_in(ws uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.memberships where workspace_id = ws and user_id = (select auth.uid())
$$;
create function private.player_in(ws uuid) returns text
language sql stable security definer set search_path = '' as $$
  select player_id from public.memberships where workspace_id = ws and user_id = (select auth.uid())
$$;
revoke all on function private.role_in(uuid), private.player_in(uuid) from public, anon;
grant execute on function private.role_in(uuid), private.player_in(uuid) to authenticated;

-- Every account gets a profile with the name given at sign-up.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;

-- Your own profile, and the profiles of your team's members if you coach it.
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.memberships m
    where m.user_id = profiles.id and private.role_in(m.workspace_id) = 'coach'
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_read on public.workspaces for select to authenticated
  using (private.role_in(id) is not null);
create policy workspaces_rename on public.workspaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.role_in(workspace_id) = 'coach');
create policy memberships_remove_player on public.memberships for delete to authenticated
  using (role = 'player' and private.role_in(workspace_id) = 'coach');

-- Onboarding: the workspace and the owner's coach membership, together.
create function public.create_workspace(p_package public.package_id, p_sport text, p_name text)
returns public.workspaces
language plpgsql security definer set search_path = '' as $$
declare
  w public.workspaces;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  insert into public.workspaces (owner_id, package, sport, name)
  values (auth.uid(), p_package, case when p_package = 'coach' then p_sport end, btrim(p_name))
  returning * into w;
  insert into public.memberships (workspace_id, user_id, role) values (w.id, auth.uid(), 'coach');
  return w;
end $$;
revoke all on function public.create_workspace(public.package_id, text, text) from public, anon;
grant execute on function public.create_workspace(public.package_id, text, text) to authenticated;
