-- Keep participant persistence aligned with lib/i18n/config.ts.
-- The public action now persists the selected language, not the English fallback.
-- No historical values, defaults, grants or RLS policies are changed.
alter table public.participants
  drop constraint participants_preferred_locale_check,
  add constraint participants_preferred_locale_check
    check (preferred_locale in ('it', 'en', 'fr', 'de', 'es', 'nl', 'uk'));
