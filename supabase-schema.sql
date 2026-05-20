create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#1976d2',
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create type public.todo_status as enum ('pending', 'done', 'archived');
create type public.todo_priority as enum ('low', 'medium', 'high');
create type public.event_type as enum ('created', 'updated', 'completed', 'restored', 'delayed', 'deleted', 'reminder');
create type public.repeat_rule as enum ('none', 'daily', 'weekly', 'monthly');

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  status public.todo_status not null default 'pending',
  priority public.todo_priority not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id uuid references public.todos(id) on delete cascade,
  title text not null,
  remind_at timestamptz not null,
  repeat_rule public.repeat_rule not null default 'none',
  channels text[] not null default array['web', 'app'],
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.todo_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id uuid references public.todos(id) on delete set null,
  event_type public.event_type not null,
  title text not null,
  category_name text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, review_date)
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.todos enable row level security;
alter table public.reminders enable row level security;
alter table public.todo_events enable row level security;
alter table public.daily_reviews enable row level security;

create policy "profiles are owned by user" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "categories are owned by user" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "todos are owned by user" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminders are owned by user" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "todo events are owned by user" on public.todo_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily reviews are owned by user" on public.daily_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = now();
  return new;
end;
';

drop trigger if exists touch_profiles_updated_at on public.profiles;
drop trigger if exists touch_categories_updated_at on public.categories;
drop trigger if exists touch_todos_updated_at on public.todos;
drop trigger if exists touch_reminders_updated_at on public.reminders;
drop trigger if exists touch_daily_reviews_updated_at on public.daily_reviews;

create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger touch_categories_updated_at
before update on public.categories
for each row execute function public.touch_updated_at();

create trigger touch_todos_updated_at
before update on public.todos
for each row execute function public.touch_updated_at();

create trigger touch_reminders_updated_at
before update on public.reminders
for each row execute function public.touch_updated_at();

create trigger touch_daily_reviews_updated_at
before update on public.daily_reviews
for each row execute function public.touch_updated_at();

create index if not exists todos_user_status_due_idx on public.todos(user_id, status, due_at);
create index if not exists reminders_user_remind_idx on public.reminders(user_id, remind_at);
create index if not exists events_user_created_idx on public.todo_events(user_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'
  ) then
    alter publication supabase_realtime add table public.todos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reminders'
  ) then
    alter publication supabase_realtime add table public.reminders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todo_events'
  ) then
    alter publication supabase_realtime add table public.todo_events;
  end if;
end;
$$;
