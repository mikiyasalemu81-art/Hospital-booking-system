-- Migration: add a single free-text "notes" field to the patients table
-- Stores an optional short note per patient (e.g. "diabetic, prefers Dr. X").
-- Idempotent: safe to run multiple times against an existing database.

alter table public.patients
  add column if not exists notes text;

comment on column public.patients.notes is
  'Optional free-text note about the patient, shown to staff during booking.';
