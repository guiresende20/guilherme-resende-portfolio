-- Run this in the Supabase SQL editor before deploying aerolito-submit.

create table if not exists aerolito_responses (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  session_id    uuid        not null,
  question_idx  smallint    not null,
  question_text text        not null,
  answer_text   text        not null,
  ip_hash       text,
  indexed       boolean     not null    default false,
  published     boolean     not null    default false,
  constraint aerolito_question_idx_range check (question_idx between 1 and 5)
);

create index if not exists aerolito_responses_session_idx on aerolito_responses (session_id);
create index if not exists aerolito_responses_indexed_idx on aerolito_responses (indexed);
