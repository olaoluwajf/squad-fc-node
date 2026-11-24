create table teams (
  id smallint primary key check (id in (1, 2)),
  team_name text not null,
  captain_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table captains (
  id uuid primary key default gen_random_uuid(),
  team_id smallint not null unique references teams(id),
  access_code_hash text not null,
  created_at timestamptz not null default now()
);
create table admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null default 'super_admin',
  created_at timestamptz not null default now()
);
create table platform_settings (
  id smallint primary key default 1 check (id = 1),
  total_capacity int not null default 24 check (total_capacity >= 2 and total_capacity % 2 = 0),
  registration_open boolean not null default true,
  waiting_list_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  position text not null check (position in ('goalkeeper', 'defender', 'midfielder', 'forward')),
  team_id smallint not null references teams(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index players_name_uq on players (lower(trim(full_name)));
create index players_team_pos_idx on players (team_id, position);
create table waiting_list (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  position text not null check (position in ('goalkeeper', 'defender', 'midfielder', 'forward')),
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'removed')),
  created_at timestamptz not null default now()
);
create unique index waiting_name_uq on waiting_list (lower(trim(full_name))) where status = 'waiting';
create table activity_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references admins(id) on delete set null,
  action text not null,
  affected_player_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create table login_attempts (
  id bigint generated always as identity primary key,
  scope text not null,
  ip text not null,
  created_at timestamptz not null default now()
);
create index login_attempts_idx on login_attempts (scope, ip, created_at);

-- Last line of defence: a team can never exceed half of the total capacity, whatever the application does.
create function enforce_team_capacity() returns trigger language plpgsql as $$
declare cap int; n int;
begin
  select total_capacity / 2 into cap from platform_settings where id = 1;
  select count(*) into n from players where team_id = new.team_id and id <> new.id;
  if n >= cap then raise exception 'Team % is full', new.team_id using errcode = '23514'; end if;
  return new;
end $$;
create trigger players_capacity before insert or update of team_id on players
  for each row execute function enforce_team_capacity();
