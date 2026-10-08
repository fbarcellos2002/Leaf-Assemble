create or replace function public.enforce_component_socket_catalog()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized_socket text;
  canonical_socket text;
  socket_entry record;
  canonical_sockets jsonb := '[]'::jsonb;
  adapter_enabled boolean;
  generic_cooler boolean;
begin
  if tg_op = 'UPDATE' then
    if new.category = 'CPU'
      and new.category = old.category
      and new.manufacturer = old.manufacturer
      and new.specs -> 'socket' is not distinct from old.specs -> 'socket' then return new; end if;
    if new.category = 'MOTHERBOARD'
      and new.category = old.category
      and new.specs -> 'socket' is not distinct from old.specs -> 'socket' then return new; end if;
    if new.category = 'CPU_COOLER'
      and new.category = old.category
      and new.specs -> 'supportedSockets' is not distinct from old.specs -> 'supportedSockets'
      and new.specs -> 'socketAdapter' is not distinct from old.specs -> 'socketAdapter' then return new; end if;
    if new.category not in ('CPU', 'MOTHERBOARD', 'CPU_COOLER')
      and new.category = old.category then return new; end if;
  end if;

  if new.category in ('CPU', 'MOTHERBOARD') then
    if jsonb_typeof(new.specs -> 'socket') is distinct from 'string'
      or length(trim(new.specs ->> 'socket')) = 0 then
      raise exception 'Selecione um socket válido para este componente.' using errcode = '23514';
    end if;

    normalized_socket := public.normalize_socket_label(new.specs ->> 'socket');
    select catalog.socket into canonical_socket
    from public.socket_catalog catalog
    where public.normalize_socket_label(catalog.socket) = normalized_socket
      and (new.category <> 'CPU' or catalog.manufacturer = trim(new.manufacturer));

    if canonical_socket is null then
      raise exception 'Socket inválido para o fabricante selecionado.' using errcode = '23514';
    end if;

    new.specs := jsonb_set(new.specs, '{socket}', to_jsonb(canonical_socket), true);
  elsif new.category = 'CPU_COOLER' then
    if jsonb_typeof(new.specs -> 'supportedSockets') is distinct from 'array'
      or jsonb_array_length(new.specs -> 'supportedSockets') = 0 then
      raise exception 'Selecione ao menos um socket compatível para o cooler.' using errcode = '23514';
    end if;
    if new.specs ? 'socketAdapter' and jsonb_typeof(new.specs -> 'socketAdapter') <> 'boolean' then
      raise exception 'A opção de adaptador precisa ser verdadeira ou falsa.' using errcode = '23514';
    end if;

    adapter_enabled := coalesce((new.specs ->> 'socketAdapter')::boolean, false);
    generic_cooler := coalesce(new.specs ->> 'socketBase' = 'Genérico', false);

    for socket_entry in
      select value from jsonb_array_elements_text(new.specs -> 'supportedSockets') as socket_values(value)
    loop
      select catalog.socket into canonical_socket
      from public.socket_catalog catalog
      where public.normalize_socket_label(catalog.socket) = public.normalize_socket_label(socket_entry.value);
      if canonical_socket is null then
        raise exception 'Socket de cooler inválido: %.', socket_entry.value using errcode = '23514';
      end if;
      if not canonical_sockets @> jsonb_build_array(canonical_socket) then
        canonical_sockets := canonical_sockets || jsonb_build_array(canonical_socket);
      end if;
    end loop;

    if jsonb_array_length(canonical_sockets) > 1 and not adapter_enabled and not generic_cooler then
      raise exception 'Ative a opção de adaptador para cadastrar mais de um socket.' using errcode = '23514';
    end if;
    new.specs := jsonb_set(new.specs, '{supportedSockets}', canonical_sockets, true);
    new.specs := jsonb_set(new.specs, '{socketAdapter}', to_jsonb(adapter_enabled), true);
  end if;

  return new;
end;
$$;
