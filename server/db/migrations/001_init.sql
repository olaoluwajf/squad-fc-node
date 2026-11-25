create table teams (
  id integer primary key check (id in (1, 2)),
  team_name text not null,
  captain_name text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table captains (
  id text primary key,
  team_id integer not null unique references teams(id),
  access_code_hash text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table admins (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  role text not null default 'super_admin',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table platform_settings (
  id integer primary key default 1 check (id = 1),
  total_capacity integer not null default 24 check (total_capacity >= 2 and total_capacity % 2 = 0),
  registration_open integer not null default 1 check (registration_open in (0, 1)),
  waiting_list_enabled integer not null default 1 check (waiting_list_enabled in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table players (
  id text primary key,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  position text not null check (position in ('goalkeeper', 'defender', 'midfielder', 'forward')),
  team_id integer not null references teams(id),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create unique index players_name_uq on players (lower(trim(full_name)));
create index players_team_pos_idx on players (team_id, position);

create table waiting_list (
  id text primary key,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  position text not null check (position in ('goalkeeper', 'defender', 'midfielder', 'forward')),
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'removed')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create unique index waiting_name_uq on waiting_list (lower(trim(full_name))) where status = 'waiting';

create table activity_logs (
  id integer primary key autoincrement,
  admin_id text references admins(id) on delete set null,
  action text not null,
  affected_player_id text,
  previous_value text,
  new_value text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table login_attempts (
  id integer primary key autoincrement,
  scope text not null,
  ip text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index login_attempts_idx on login_attempts (scope, ip, created_at);

create trigger players_capacity_insert
before insert on players
when (select count(*) from players where team_id = new.team_id) >=
     (select total_capacity / 2 from platform_settings where id = 1)
begin
  select raise(abort, 'A team is full');
end;

create trigger players_capacity_move
before update of team_id on players
when new.team_id <> old.team_id
  and (select count(*) from players where team_id = new.team_id and id <> old.id) >=
      (select total_capacity / 2 from platform_settings where id = 1)
begin
  select raise(abort, 'A team is full');
end;
