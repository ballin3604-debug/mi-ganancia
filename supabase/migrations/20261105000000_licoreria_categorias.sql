-- Licorería: reemplaza el catálogo de categorías por el definido para el rubro
-- y reasigna los productos que quedaron con categorías viejas.

do $$
declare
  v_column_type text;
  v_categories text[] := array[
    'Cervezas',
    'Vinos y tragos',
    'Cigarros',
    'Energizantes',
    'Peques sodas',
    'Sodas 2LTS',
    'Sodas 3LTS',
    'Snacks',
    'Abarrotes'
  ];
begin
  select c.data_type
    into v_column_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'business_settings'
    and c.column_name = 'categories';

  if v_column_type = 'ARRAY' then
    update public.business_settings
       set categories = v_categories
     where business_category = 'licorera';
  elsif v_column_type = 'json' then
    update public.business_settings
       set categories = to_json(v_categories)
     where business_category = 'licorera';
  else
    update public.business_settings
       set categories = to_jsonb(v_categories)
     where business_category = 'licorera';
  end if;
end $$;

update public.products p
   set category = case
     when p.category = 'Cervezas' then 'Cervezas'
     when p.category in ('Whiskey', 'Ron', 'Vinos', 'Vodka') then 'Vinos y tragos'
     when p.category = 'Cigarros' then 'Cigarros'
     when p.category = 'Energizantes' then 'Energizantes'
     when p.category = 'Peques sodas' then 'Peques sodas'
     when p.category = 'Sodas 2LTS' then 'Sodas 2LTS'
     when p.category = 'Sodas 3LTS' then 'Sodas 3LTS'
     when p.category in ('Snacks', 'Snacks y dulces') then 'Snacks'
     when p.category = 'Refrescos' then 'Sodas 2LTS'
     else 'Abarrotes'
   end
 where p.business_id in (
   select business_id
   from public.business_settings
   where business_category = 'licorera'
 )
 and p.category not in (
   'Cervezas',
   'Vinos y tragos',
   'Cigarros',
   'Energizantes',
   'Peques sodas',
   'Sodas 2LTS',
   'Sodas 3LTS',
   'Snacks',
   'Abarrotes'
 );
