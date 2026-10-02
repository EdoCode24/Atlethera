-- Live meetings: one open session per calendar meeting, each with its own LiveKit room.

create table public.live_meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  event_id text not null,
  -- Opaque LiveKit room name: no team or event names travel to the video service.
  room text not null unique,
  started_by uuid not null references auth.users on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index live_meetings_one_open on public.live_meetings (workspace_id, event_id) where ended_at is null;

-- Who joined, so the coach's browser can fill the meeting's attendance.
create table public.meeting_joins (
  live_meeting_id uuid not null references public.live_meetings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  player_id text,
  first_joined_at timestamptz not null default now(),
  primary key (live_meeting_id, user_id)
);

alter table public.live_meetings enable row level security;
alter table public.meeting_joins enable row level security;
create policy live_meetings_read on public.live_meetings for select to authenticated
  using (private.role_in(workspace_id) is not null);
create policy meeting_joins_coach_read on public.meeting_joins for select to authenticated using (
  exists (select 1 from public.live_meetings l where l.id = live_meeting_id and private.role_in(l.workspace_id) = 'coach')
);

-- Opens (or reopens) the live session of a calendar meeting. Coaches only.
create function public.start_live_meeting(p_ws uuid, p_event text) returns public.live_meetings
language plpgsql security definer set search_path = '' as $$
declare
  m public.live_meetings;
begin
  if private.role_in(p_ws) is distinct from 'coach' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.documents d, jsonb_array_elements(d.value) e
    where d.workspace_id = p_ws and d.key = 'calendar' and e ->> 'id' = p_event and e ->> 'kind' = 'meeting'
  ) then
    raise exception 'not_a_meeting';
  end if;
  -- A session nobody ended counts as over after eight hours.
  update public.live_meetings set ended_at = now()
   where workspace_id = p_ws and event_id = p_event and ended_at is null and started_at < now() - interval '8 hours';
  select * into m from public.live_meetings where workspace_id = p_ws and event_id = p_event and ended_at is null;
  if found then return m; end if;
  insert into public.live_meetings (workspace_id, event_id, room, started_by)
  values (p_ws, p_event, 'atl_' || replace(gen_random_uuid()::text, '-', ''), auth.uid())
  returning * into m;
  return m;
end $$;

create function public.end_live_meeting(p_id uuid) returns public.live_meetings
language plpgsql security definer set search_path = '' as $$
declare
  m public.live_meetings;
begin
  update public.live_meetings set ended_at = now()
   where id = p_id and ended_at is null and private.role_in(workspace_id) = 'coach'
  returning * into m;
  if not found then raise exception 'not_found'; end if;
  return m;
end $$;

create function public.record_meeting_join(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.meeting_joins (live_meeting_id, user_id, player_id)
  select l.id, auth.uid(), private.player_in(l.workspace_id)
    from public.live_meetings l
   where l.id = p_id and l.ended_at is null and private.role_in(l.workspace_id) = 'player'
  on conflict do nothing;
end $$;

revoke all on function public.start_live_meeting(uuid, text), public.end_live_meeting(uuid), public.record_meeting_join(uuid) from public, anon;
grant execute on function public.start_live_meeting(uuid, text), public.end_live_meeting(uuid), public.record_meeting_join(uuid) to authenticated;

-- Tell the team's browsers when a meeting goes live, ends, or someone joins.
create function private.live_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
begin
  if tg_table_name = 'live_meetings' then
    ws := coalesce(new.workspace_id, old.workspace_id);
  else
    select workspace_id into ws from public.live_meetings where id = coalesce(new.live_meeting_id, old.live_meeting_id);
  end if;
  if ws is not null then
    perform realtime.send('{}'::jsonb, 'live', 'ws:' || ws::text, true);
  end if;
  return null;
end $$;
create trigger live_meetings_changed after insert or update or delete on public.live_meetings
  for each row execute function private.live_changed();
create trigger meeting_joins_changed after insert on public.meeting_joins
  for each row execute function private.live_changed();
