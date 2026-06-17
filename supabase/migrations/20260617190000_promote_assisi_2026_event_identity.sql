-- Promote the Assisi 2026 bootstrap event to its official public identity.
-- The historical slug stays unchanged for compatibility with existing seeds,
-- scripts and operational references; it must not be shown as user-facing copy.

update public.events
set
  title = 'UNHARMED AND DISARMING PEACE - PACE DISARMATA E DISARMANTE',
  city = 'Assisi',
  country = 'Italia'
where slug = 'assisi-2026-test';

notify pgrst, 'reload schema';
