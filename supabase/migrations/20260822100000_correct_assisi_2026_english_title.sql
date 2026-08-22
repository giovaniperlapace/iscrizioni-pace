-- Correct the official English event title in already-provisioned environments.
-- The historical slug remains unchanged for compatibility.

update public.events
set title = 'UNARMED AND DISARMING PEACE - PACE DISARMATA E DISARMANTE'
where slug = 'assisi-2026-test';
