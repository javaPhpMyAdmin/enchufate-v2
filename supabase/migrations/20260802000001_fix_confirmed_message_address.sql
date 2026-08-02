-- =========================================================================
-- fix_confirmed_message_address — keep raw coordinates out of system messages
-- =========================================================================
-- When a host confirms a reservation,
-- `handle_reservation_confirmed_system_message` renders
-- `chargers.address` verbatim into the chat. Legacy chargers can carry
-- raw coordinates in `address` ("-34.9012, -56.2090") because the
-- publish wizard's reverse geocoder fell back to `coordsAsAddress()`
-- when geocoding failed. This migration re-creates the function so a
-- coordinate-shaped address drops the "Dirección: ..." clause entirely:
-- the message still confirms the reservation, but never leaks raw
-- lat/lng to the guest.
--
-- `create or replace function` keeps the existing trigger
-- `trg_reservation_confirmed_msg` bound to this function — the trigger
-- is NOT re-created here.
-- =========================================================================

-- -------------------------------------------------------------------------
-- handle_reservation_confirmed_system_message
-- -------------------------------------------------------------------------
create or replace function public.handle_reservation_confirmed_system_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_charger_title text;
  v_charger_address text;
  -- Byte-identical to COORD_REGEX in `src/lib/geocode.ts`.
  -- MUST stay in lockstep with the client: the client uses the
  -- pattern to detect legacy coordinate addresses (publish guard,
  -- resolved-address hook, share sheet), and this trigger uses it
  -- to keep raw coordinates out of user-facing messages. Both sides
  -- accept 1-8 decimal digits so a partially edited fallback like
  -- "-34.9, -56.2" is caught on the server too.
  v_coord_pattern constant text := '^-?\d{1,3}\.\d{1,8}\s*,\s*-?\d{1,3}\.\d{1,8}$';
begin
  -- Skip when the status didn't transition to 'confirmada'. The
  -- trigger fires AFTER UPDATE, so we read `old.status` to detect
  -- the transition.
  if new.status = 'confirmada' and (old.status is null or old.status <> 'confirmada') then
    select c.id, ch.title, ch.address
      into v_conv_id, v_charger_title, v_charger_address
      from public.conversations c
      join public.chargers ch on ch.id = c.charger_id
     where c.charger_id = new.charger_id
       and c.renter_id  = new.renter_id;

    if v_conv_id is not null then
      -- Coordinate-shaped address (legacy chargers): omit the
      -- "Dirección: ..." clause. `btrim(v_charger_address, E' \t\n\r')`
      -- mirrors JS `String.prototype.trim()` (which
      -- `isCoordinateAddress` in `src/lib/geocode.ts` calls before
      -- testing the pattern), so the client and the server classify
      -- the same string the same way. Plain PG `trim(text)` strips
      -- only ASCII spaces — a newline- or tab-padded address would
      -- be classified differently than the client — hence the
      -- explicit whitespace set.
      if btrim(v_charger_address, E' \t\n\r') ~ v_coord_pattern then
        insert into public.messages (conversation_id, sender_id, body, kind)
        values (
          v_conv_id,
          null,
          format(
            '¡Listo! Tu reserva de %s fue confirmada. Chateamos para coordinar.',
            v_charger_title
          ),
          'system_reservation_confirmed'
        );
      else
        -- Human-readable address: keep the full template byte-identical
        -- to the pre-fix message (punctuation and spacing preserved).
        insert into public.messages (conversation_id, sender_id, body, kind)
        values (
          v_conv_id,
          null,
          format(
            '¡Listo! Tu reserva de %s fue confirmada. Chateamos para coordinar. Dirección: %s.',
            v_charger_title,
            v_charger_address
          ),
          'system_reservation_confirmed'
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;
