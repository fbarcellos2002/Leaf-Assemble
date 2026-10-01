update public.components
set specs = jsonb_set(
  specs,
  '{socket}',
  to_jsonb(case
    when upper(trim(specs ->> 'socket')) ~ '^LGA[[:space:]]*[0-9]+$'
      then regexp_replace(upper(trim(specs ->> 'socket')), '^LGA[[:space:]]*', 'LGA ')
    when upper(trim(specs ->> 'socket')) ~ '^AM[[:space:]]*[0-9]+$'
      then regexp_replace(upper(trim(specs ->> 'socket')), '^AM[[:space:]]*', 'AM ')
    when category = 'CPU' and manufacturer = 'Intel' and trim(specs ->> 'socket') ~ '^[0-9]+$'
      then 'LGA ' || trim(specs ->> 'socket')
    when category = 'CPU' and manufacturer = 'AMD' and trim(specs ->> 'socket') ~ '^[0-9]+$'
      then 'AM ' || trim(specs ->> 'socket')
  end),
  false
)
where category in ('CPU', 'MOTHERBOARD')
  and jsonb_typeof(specs -> 'socket') = 'string'
  and (
    upper(trim(specs ->> 'socket')) ~ '^(LGA|AM)[[:space:]]*[0-9]+$'
    or (category = 'CPU' and manufacturer in ('Intel', 'AMD') and trim(specs ->> 'socket') ~ '^[0-9]+$')
  );

update public.components
set description = concat_ws(
  ' - ',
  case
    when lower(trim(name)) like lower(trim(manufacturer)) || '%' then trim(name)
    else concat_ws(' ', nullif(trim(manufacturer), ''), nullif(trim(name), ''))
  end,
  nullif(concat_ws(
    ' ',
    case when jsonb_typeof(specs -> 'cores') = 'number' then (specs ->> 'cores') || 'N' end,
    case when jsonb_typeof(specs -> 'threads') = 'number' then (specs ->> 'threads') || 'T' end
  ), ''),
  nullif(trim(specs ->> 'socket'), '')
)
where category = 'CPU';
