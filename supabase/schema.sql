create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'user');
  end if;
end $$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  phone text not null unique,
  email text unique,
  password_hash text not null,
  phone_verified_at timestamptz,
  role app_role not null default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_users add column if not exists auth_user_id uuid;
alter table public.app_users add column if not exists phone_verified_at timestamptz;
create unique index if not exists app_users_auth_user_id_key on public.app_users(auth_user_id) where auth_user_id is not null;

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_content (
  section_key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'employee_gender') then
    create type employee_gender as enum ('male', 'female');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'marital_status') then
    create type marital_status as enum ('single', 'married', 'divorced', 'widowed');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'administrative_request_type') then
    create type administrative_request_type as enum ('leave', 'permission', 'financial', 'general');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'administrative_request_status') then
    create type administrative_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'leave_allocation_type') then
    create type leave_allocation_type as enum ('leave_balance', 'allowance');
  end if;
end $$;

create table if not exists public.employee_profiles (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  national_id text not null,
  birth_date date not null,
  gender employee_gender not null,
  marital_status marital_status not null,
  job_rank text not null,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_leave_balances (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  leave_quota_days integer not null default 0,
  leave_taken_days integer not null default 0,
  allowance_total_days integer not null default 0,
  allowance_used_days integer not null default 0,
  permission_quota_count integer not null default 0,
  permission_used_count integer not null default 0,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.administrative_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  request_type administrative_request_type not null,
  status administrative_request_status not null default 'pending',
  subject text not null,
  details text not null,
  amount_requested numeric(12,2),
  start_date date,
  end_date date,
  request_date date,
  from_time text,
  to_time text,
  leave_allocation_type leave_allocation_type,
  reviewed_by uuid references public.app_users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.work_location_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'موقع العمل الرئيسي',
  address text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 100,
  google_maps_url text not null default '',
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  work_date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  clock_in_latitude double precision,
  clock_in_longitude double precision,
  clock_out_latitude double precision,
  clock_out_longitude double precision,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, work_date)
);

create table if not exists public.supporter_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gifting_requests (
  id uuid primary key default gen_random_uuid(),
  item_id integer not null,
  item_title text not null,
  donor_name text not null,
  recipient_name text not null,
  recipient_phone text not null,
  donation_label text,
  amount numeric(12,2) not null default 0,
  section_key text not null default 'giftings',
  submitted_at timestamptz not null default timezone('utc', now()),
  sms_status text not null default 'pending',
  sms_template text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.service_media_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_kind text not null check (asset_kind in ('stamp', 'signature')),
  image_url text not null,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.service_document_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  content_html text not null default '',
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.app_users(id) on delete cascade,
  message_text text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  assigned_to_user_id uuid not null references public.app_users(id) on delete cascade,
  assigned_by_user_id uuid not null references public.app_users(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'under_review', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  task_id uuid references public.user_tasks(id) on delete cascade,
  notification_type text not null check (notification_type in ('new_task', 'due_soon')),
  title text not null,
  body text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.weekly_achievement_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  achievement_text text not null,
  image_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id);
create index if not exists app_sessions_expires_at_idx on public.app_sessions(expires_at);
create index if not exists administrative_requests_user_id_idx on public.administrative_requests(user_id);
create index if not exists administrative_requests_status_idx on public.administrative_requests(status);
create index if not exists attendance_records_user_id_idx on public.attendance_records(user_id);
create index if not exists attendance_records_work_date_idx on public.attendance_records(work_date desc);
create index if not exists supporter_contacts_phone_idx on public.supporter_contacts(phone);
create index if not exists gifting_requests_submitted_at_idx on public.gifting_requests(submitted_at desc);
create index if not exists service_media_assets_kind_idx on public.service_media_assets(asset_kind);
create index if not exists service_document_templates_updated_at_idx on public.service_document_templates(updated_at desc);
create index if not exists admin_chat_messages_created_at_idx on public.admin_chat_messages(created_at desc);
create index if not exists user_tasks_assigned_to_idx on public.user_tasks(assigned_to_user_id);
create index if not exists user_tasks_due_at_idx on public.user_tasks(due_at asc);
create index if not exists task_notifications_user_id_idx on public.task_notifications(user_id, created_at desc);
create index if not exists weekly_achievement_entries_user_week_idx on public.weekly_achievement_entries(user_id, week_start_date desc);
create index if not exists weekly_achievement_entries_week_idx on public.weekly_achievement_entries(week_start_date desc, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on public.app_users;

create trigger app_users_set_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

drop trigger if exists site_content_set_updated_at on public.site_content;

create trigger site_content_set_updated_at
before update on public.site_content
for each row
execute function public.set_updated_at();

drop trigger if exists employee_profiles_set_updated_at on public.employee_profiles;

create trigger employee_profiles_set_updated_at
before update on public.employee_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists employee_leave_balances_set_updated_at on public.employee_leave_balances;

create trigger employee_leave_balances_set_updated_at
before update on public.employee_leave_balances
for each row
execute function public.set_updated_at();

drop trigger if exists administrative_requests_set_updated_at on public.administrative_requests;

create trigger administrative_requests_set_updated_at
before update on public.administrative_requests
for each row
execute function public.set_updated_at();

drop trigger if exists work_location_settings_set_updated_at on public.work_location_settings;

create trigger work_location_settings_set_updated_at
before update on public.work_location_settings
for each row
execute function public.set_updated_at();

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;

create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row
execute function public.set_updated_at();

drop trigger if exists supporter_contacts_set_updated_at on public.supporter_contacts;

create trigger supporter_contacts_set_updated_at
before update on public.supporter_contacts
for each row
execute function public.set_updated_at();

drop trigger if exists service_media_assets_set_updated_at on public.service_media_assets;

create trigger service_media_assets_set_updated_at
before update on public.service_media_assets
for each row
execute function public.set_updated_at();

drop trigger if exists service_document_templates_set_updated_at on public.service_document_templates;

create trigger service_document_templates_set_updated_at
before update on public.service_document_templates
for each row
execute function public.set_updated_at();

drop trigger if exists user_tasks_set_updated_at on public.user_tasks;

create trigger user_tasks_set_updated_at
before update on public.user_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists weekly_achievement_entries_set_updated_at on public.weekly_achievement_entries;

create trigger weekly_achievement_entries_set_updated_at
before update on public.weekly_achievement_entries
for each row
execute function public.set_updated_at();

insert into public.app_users (full_name, phone, email, password_hash, phone_verified_at, role)
values (
  'مشرف النظام',
  '+966500000000',
  'admin@example.com',
  '$2b$12$replace_this_with_a_real_bcrypt_hash',
  timezone('utc', now()),
  'admin'
)
on conflict (phone) do nothing;