-- Plan Pro: hasta 5 usuarios (antes 3). Premium sigue en 10.

update public.plans
   set max_users = 5
 where id = 'pro';

create or replace function public.plan_limits(p_plan_id text)
returns table(max_products integer, max_users integer, allow_branches boolean)
language sql
immutable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case p_plan_id
    when 'premium' then 1000000
    when 'pro' then 1000000
    else 1000000
  end,
  case p_plan_id
    when 'premium' then 10
    when 'pro' then 5
    else 5
  end,
  (p_plan_id = 'premium')
$function$;
