alter table public.qr_tokens
  add column if not exists token_encrypted text;

comment on column public.qr_tokens.token_encrypted is
  'Application-encrypted opaque QR token used only server-side to regenerate participant QR codes.';
