-- UP
alter table public.reps
add column feedback_good text,
add column feedback_improve text,
add column next_focus text;

-- DOWN
alter table public.reps
drop column feedback_good,
drop column feedback_improve,
drop column next_focus;