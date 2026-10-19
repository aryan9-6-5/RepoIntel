-- Global (cross-isolate) rate limiting. Additive and reversible:
--   drop function public.rl_hit(text, int, int); drop table public.rate_limits;
create table if not exists public.rate_limits (
  key text not null,
  window_start bigint not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- RLS on, no policies: anon/authenticated cannot read or write. Only the service role (used by edge functions) can.
alter table public.rate_limits enable row level security;

-- Atomic fixed-window counter. Returns true when the caller is OVER p_max in the current window.
-- ponytail: fixed window allows up to 2x p_max across a window boundary; sliding window if that matters.
create or replace function public.rl_hit(p_key text, p_window_sec int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w bigint := floor(extract(epoch from now()) / p_window_sec)::bigint;
  c int;
begin
  insert into rate_limits (key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  -- opportunistic cleanup keeps the table tiny without a cron job
  if random() < 0.02 then
    delete from rate_limits where window_start < w - 5;
  end if;
  return c > p_max;
end;
$$;

revoke all on function public.rl_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rl_hit(text, int, int) to service_role;
