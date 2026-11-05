-- Licorería: reemplaza el catálogo de categorías para los negocios que ahora
-- son licorería. La primera migración (20261105000000) solo alcanzó a los
-- negocios que ya estaban marcados como licorera; esta versión alcanza a los
-- que se cambiaron de rubro después, y reasigna sus productos.

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

-- Reasigna los productos de las licorerías según el mismo criterio que usa la
-- app (normalizeLicorCategory): palabras clave por categoría y, si nada
-- coincide, Abarrotes (categoría comodín de licorería).
update public.products p
   set category = case
     when lower(p.category) like '%cerveza%' then 'Cervezas'
     when lower(p.category) like any (array['%whiskey%', '%ron%', '%vino%', '%vodka%', '%trago%', '%licor%']) then 'Vinos y tragos'
     when lower(p.category) like any (array['%cigarro%', '%tabaco%']) then 'Cigarros'
     when lower(p.category) like '%energiz%' then 'Energizantes'
     when lower(p.category) like any (array['%snack%', '%galleta%', '%dulce%']) then 'Snacks'
     when lower(p.category) like any (array['%3lt%', '%3 l%']) then 'Sodas 3LTS'
     when lower(p.category) like any (array['%2lt%', '%2 l%']) then 'Sodas 2LTS'
     when lower(p.category) like any (array['%soda%', '%refresco%', '%peque%']) then 'Peques sodas'
     else 'Abarrotes'
   end
 where p.business_id in (
   select business_id
   from public.business_settings
   where business_category = 'licorera'
 )
 and (
   p.category is null
   or p.category not in (
     'Cervezas',
     'Vinos y tragos',
     'Cigarros',
     'Energizantes',
     'Peques sodas',
     'Sodas 2LTS',
     'Sodas 3LTS',
     'Snacks',
     'Abarrotes'
   )
 );
