-- ==============================================================================
-- SUPABASE SCHEMA FIXES & AUDIT RECONCILIATION
-- ==============================================================================
-- Idempotent DDL statements to ensure all tables, columns, indexes, and
-- Row Level Security (RLS) policies exist and match the application code.
--
-- Safe to run multiple times against any existing Supabase instance.
-- Ends with: notify pgrst, 'reload schema'; to immediately flush the schema cache.
-- ==============================================================================

-- 1. Ensure required extensions exist
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- TABLE: clinics
-- ==============================================================================
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  timezone text default 'Africa/Addis_Ababa',
  created_at timestamptz default now()
);

alter table public.clinics add column if not exists name text;
alter table public.clinics add column if not exists phone text;
alter table public.clinics add column if not exists timezone text default 'Africa/Addis_Ababa';
alter table public.clinics add column if not exists created_at timestamptz default now();

-- ==============================================================================
-- TABLE: staff
-- ==============================================================================
create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  role text not null default 'staff',
  created_at timestamptz default now()
);

alter table public.staff add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.staff add column if not exists full_name text;
alter table public.staff add column if not exists role text default 'staff';
alter table public.staff add column if not exists created_at timestamptz default now();

create index if not exists idx_staff_clinic_id on public.staff(clinic_id);

-- ==============================================================================
-- TABLE: doctors
-- ==============================================================================
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  department text,
  slot_minutes integer not null default 30,
  work_days integer[] not null default '{1,2,3,4,5}',
  start_time time not null default '08:00:00',
  end_time time not null default '17:00:00',
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.doctors add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.doctors add column if not exists full_name text;
alter table public.doctors add column if not exists department text;
alter table public.doctors add column if not exists slot_minutes integer default 30;
alter table public.doctors add column if not exists work_days integer[] default '{1,2,3,4,5}';
alter table public.doctors add column if not exists start_time time default '08:00:00';
alter table public.doctors add column if not exists end_time time default '17:00:00';
alter table public.doctors add column if not exists active boolean default true;
alter table public.doctors add column if not exists created_at timestamptz default now();

create index if not exists idx_doctors_clinic_id on public.doctors(clinic_id);
create index if not exists idx_doctors_active on public.doctors(clinic_id, active);

-- ==============================================================================
-- TABLE: patients
-- ==============================================================================
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  phone text not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.patients add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.patients add column if not exists full_name text;
alter table public.patients add column if not exists phone text;
alter table public.patients add column if not exists notes text;
alter table public.patients add column if not exists created_at timestamptz default now();

create index if not exists idx_patients_clinic_id on public.patients(clinic_id);
create index if not exists idx_patients_phone on public.patients(clinic_id, phone);

-- ==============================================================================
-- TABLE: appointments
-- ==============================================================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  reminder_24h_sent boolean not null default false,
  reminder_2h_sent boolean not null default false,
  created_at timestamptz default now()
);

alter table public.appointments add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.appointments add column if not exists doctor_id uuid references public.doctors(id) on delete cascade;
alter table public.appointments add column if not exists patient_id uuid references public.patients(id) on delete cascade;
alter table public.appointments add column if not exists starts_at timestamptz;
alter table public.appointments add column if not exists ends_at timestamptz;
alter table public.appointments add column if not exists status text default 'booked';
alter table public.appointments add column if not exists notes text;
alter table public.appointments add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.appointments add column if not exists reminder_24h_sent boolean default false;
alter table public.appointments add column if not exists reminder_2h_sent boolean default false;
alter table public.appointments add column if not exists created_at timestamptz default now();

create index if not exists idx_appointments_clinic_date on public.appointments(clinic_id, starts_at);
create index if not exists idx_appointments_doctor_date on public.appointments(doctor_id, starts_at);
create index if not exists idx_appointments_status on public.appointments(clinic_id, status);

-- ==============================================================================
-- TABLE: sms_log
-- ==============================================================================
create table if not exists public.sms_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  phone text not null,
  message text not null,
  kind text not null,
  status text not null default 'sent',
  provider_response text,
  created_at timestamptz default now()
);

alter table public.sms_log add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.sms_log add column if not exists appointment_id uuid references public.appointments(id) on delete set null;
alter table public.sms_log add column if not exists phone text;
alter table public.sms_log add column if not exists message text;
alter table public.sms_log add column if not exists kind text;
alter table public.sms_log add column if not exists status text default 'sent';
alter table public.sms_log add column if not exists provider_response text;
alter table public.sms_log add column if not exists created_at timestamptz default now();

create index if not exists idx_sms_log_clinic_created on public.sms_log(clinic_id, created_at desc);

-- ==============================================================================
-- TABLE: waitlist (New Table with Multi-Tenant clinic_id)
-- ==============================================================================
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  patient_id uuid references public.patients(id) on delete cascade,
  preferred_date date,
  status text not null default 'waiting',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.waitlist add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.waitlist add column if not exists doctor_id uuid references public.doctors(id) on delete set null;
alter table public.waitlist add column if not exists patient_id uuid references public.patients(id) on delete cascade;
alter table public.waitlist add column if not exists preferred_date date;
alter table public.waitlist add column if not exists status text default 'waiting';
alter table public.waitlist add column if not exists notes text;
alter table public.waitlist add column if not exists created_at timestamptz default now();

create index if not exists idx_waitlist_clinic on public.waitlist(clinic_id, created_at desc);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Ensures strict multi-tenancy: each authenticated clinic staff member can only
-- read and modify rows matching their own clinic_id.
-- ==============================================================================

alter table public.clinics enable row level security;
alter table public.staff enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.sms_log enable row level security;
alter table public.waitlist enable row level security;

-- 1. clinics RLS
drop policy if exists "Staff can view their clinic" on public.clinics;
create policy "Staff can view their clinic"
  on public.clinics for select
  using (id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Public can view clinic profile for booking" on public.clinics;
create policy "Public can view clinic profile for booking"
  on public.clinics for select
  using (true);

-- 2. staff RLS
drop policy if exists "Staff can view members in their clinic" on public.staff;
create policy "Staff can view members in their clinic"
  on public.staff for select
  using (
    clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid())
    or id = auth.uid()
  );

-- 3. doctors RLS
drop policy if exists "Staff can manage doctors in their clinic" on public.doctors;
create policy "Staff can manage doctors in their clinic"
  on public.doctors for all
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()))
  with check (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Public can view active doctors" on public.doctors;
create policy "Public can view active doctors"
  on public.doctors for select
  using (active = true);

-- 4. patients RLS
drop policy if exists "Staff can view patients of their clinic" on public.patients;
create policy "Staff can view patients of their clinic"
  on public.patients for select
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Staff can insert patients for their clinic" on public.patients;
create policy "Staff can insert patients for their clinic"
  on public.patients for insert
  with check (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Staff can update patients of their clinic" on public.patients;
create policy "Staff can update patients of their clinic"
  on public.patients for update
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()))
  with check (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

-- 5. appointments RLS
drop policy if exists "Staff can manage appointments in their clinic" on public.appointments;
create policy "Staff can manage appointments in their clinic"
  on public.appointments for all
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()))
  with check (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

-- 6. sms_log RLS
drop policy if exists "Staff can view sms_log of their clinic" on public.sms_log;
create policy "Staff can view sms_log of their clinic"
  on public.sms_log for select
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Staff can insert sms_log for their clinic" on public.sms_log;
create policy "Staff can insert sms_log for their clinic"
  on public.sms_log for insert
  with check (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

-- 7. waitlist RLS (New Table)
drop policy if exists "Staff can view waitlist of their clinic" on public.waitlist;
create policy "Staff can view waitlist of their clinic"
  on public.waitlist for select
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Staff can insert waitlist for their clinic" on public.waitlist;
create policy "Staff can insert waitlist for their clinic"
  on public.waitlist for insert
  with check (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Staff can update waitlist for their clinic" on public.waitlist;
create policy "Staff can update waitlist for their clinic"
  on public.waitlist for update
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()))
  with check (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

drop policy if exists "Staff can delete waitlist for their clinic" on public.waitlist;
create policy "Staff can delete waitlist for their clinic"
  on public.waitlist for delete
  using (clinic_id in (select s.clinic_id from public.staff s where s.id = auth.uid()));

-- ==============================================================================
-- 8. RELOAD SCHEMA CACHE
-- ==============================================================================
-- Tells PostgREST to immediately refresh its schema cache so the new 'notes'
-- column and any newly added tables/columns are instantly available to queries.
notify pgrst, 'reload schema';
