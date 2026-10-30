create table if not exists public.pazings_profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    full_name text not null default '',
    role text not null default 'staff' check (role in ('owner', 'staff')),
    status text not null default 'active' check (status in ('active', 'inactive')),
    created_at timestamptz not null default now()
);

alter table public.pazings_profiles
    add column if not exists pin_lookup text unique,
    add column if not exists pin_salt text,
    add column if not exists pin_hash text;

create table if not exists public.pazings_pin_login_limits (
    client_key text primary key,
    failed_attempts integer not null default 0,
    window_started_at timestamptz not null default now(),
    locked_until timestamptz
);

create or replace function public.pazings_pin_login_allowed(p_client_key text, p_success boolean default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    attempt_record public.pazings_pin_login_limits%rowtype;
begin
    insert into public.pazings_pin_login_limits (client_key)
    values (p_client_key)
    on conflict (client_key) do nothing;

    select * into attempt_record
    from public.pazings_pin_login_limits
    where client_key = p_client_key
    for update;

    if attempt_record.locked_until > now() then
        return false;
    end if;

    if p_success is null then
        return true;
    elsif p_success then
        update public.pazings_pin_login_limits
        set failed_attempts = 0, window_started_at = now(), locked_until = null
        where client_key = p_client_key;
        return true;
    end if;

    if attempt_record.window_started_at < now() - interval '15 minutes' then
        attempt_record.failed_attempts := 0;
        attempt_record.window_started_at := now();
    end if;
    attempt_record.failed_attempts := attempt_record.failed_attempts + 1;
    update public.pazings_pin_login_limits
    set failed_attempts = attempt_record.failed_attempts,
        window_started_at = attempt_record.window_started_at,
        locked_until = case
            when attempt_record.failed_attempts >= 5 then now() + interval '15 minutes'
            else null
        end
    where client_key = p_client_key;
    return true;
end;
$$;

create table if not exists public.pazings_services (
    id text primary key,
    category text not null check (category in ('water', 'laundry')),
    service_code text not null unique,
    service_name text not null,
    default_rate numeric(10, 2) not null default 0 check (default_rate >= 0),
    unit_label text not null default 'qty',
    is_active boolean not null default true,
    display_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.pazings_transactions (
    id text primary key,
    transaction_code text not null unique,
    business_category text not null check (business_category in ('water', 'laundry')),
    transaction_date date not null,
    transaction_time text not null,
    customer_name text not null,
    total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
    payment_method text not null default 'Cash',
    payment_status text not null default 'paid' check (payment_status in ('paid', 'unpaid')),
    items jsonb not null default '[]'::jsonb,
    notes text not null default '',
    created_by uuid not null references public.pazings_profiles (id),
    created_at timestamptz not null default now()
);

create index if not exists pazings_transactions_date_idx
    on public.pazings_transactions (transaction_date desc, transaction_time desc);

create table if not exists public.pazings_expenses (
    id text primary key,
    expense_date date not null,
    business_category text not null check (business_category in ('water', 'laundry', 'shared')),
    particular text not null,
    quantity numeric(10, 2),
    unit_price numeric(10, 2),
    total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
    notes text not null default '',
    created_by uuid not null references public.pazings_profiles (id),
    created_at timestamptz not null default now()
);

create index if not exists pazings_expenses_date_idx
    on public.pazings_expenses (expense_date desc, created_at desc);

create table if not exists public.pazings_customers (
    id bigint generated always as identity primary key,
    name text not null,
    name_key text generated always as (lower(trim(name))) stored unique,
    contact_number text not null default '',
    address text not null default '',
    notes text not null default '',
    total_orders integer not null default 0,
    lifetime_spend numeric(12, 2) not null default 0,
    last_order_date date,
    created_at timestamptz not null default now()
);

create table if not exists public.pazings_transaction_counters (
    business_category text not null check (business_category in ('water', 'laundry')),
    transaction_date date not null,
    last_number integer not null default 0,
    primary key (business_category, transaction_date)
);

create or replace function public.pazings_next_transaction_code(p_category text, p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    next_number integer;
    prefix text;
begin
    if p_category not in ('water', 'laundry') then
        raise exception 'Invalid transaction category';
    end if;

    insert into public.pazings_transaction_counters (business_category, transaction_date, last_number)
    values (p_category, p_date, 1)
    on conflict (business_category, transaction_date)
    do update set last_number = public.pazings_transaction_counters.last_number + 1
    returning last_number into next_number;

    prefix := case when p_category = 'water' then 'WTR' else 'LND' end;
    return prefix || '-' || to_char(p_date, 'YYYYMMDD') || '-' || lpad(next_number::text, 3, '0');
end;
$$;

create or replace function public.pazings_service_is_referenced(p_service_id text)
returns boolean
language sql
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.pazings_transactions as tx
        cross join lateral jsonb_array_elements(tx.items) as item
        where item ->> 'serviceId' = p_service_id
           or lower(item ->> 'itemName') = lower((
                select service_name
                from public.pazings_services
                where id = p_service_id
           ))
    );
$$;

create or replace function public.pazings_save_rates(p_rates jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    updated_count integer;
begin
    update public.pazings_services as service
    set default_rate = (rate.value)::numeric
    from jsonb_each_text(p_rates) as rate
    where service.id = rate.key
      and (rate.value)::numeric >= 0;
    get diagnostics updated_count = row_count;
    return updated_count;
end;
$$;

create or replace function public.pazings_create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.pazings_profiles (id, email, full_name)
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data ->> 'full_name', '')
    )
    on conflict (id) do update
        set email = excluded.email,
            full_name = case
                when excluded.full_name <> '' then excluded.full_name
                else public.pazings_profiles.full_name
            end;
    return new;
end;
$$;

drop trigger if exists pazings_auth_user_created on auth.users;
create trigger pazings_auth_user_created
    after insert or update of email on auth.users
    for each row execute function public.pazings_create_profile();

create or replace function public.pazings_record_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_name text;
    target_key text;
    agg_orders integer;
    agg_spend numeric(12, 2);
    agg_last_date date;
begin
    if tg_op = 'DELETE' then
        target_name := trim(old.customer_name);
    else
        target_name := trim(new.customer_name);
    end if;

    target_key := lower(target_name);

    if target_name <> '' and target_key <> 'walk-in customer' then
        select
            count(*)::integer,
            coalesce(sum(total_amount), 0),
            max(transaction_date)
        into agg_orders, agg_spend, agg_last_date
        from public.pazings_transactions
        where lower(trim(customer_name)) = target_key;

        if agg_orders > 0 then
            insert into public.pazings_customers (
                name, total_orders, lifetime_spend, last_order_date
            )
            values (target_name, agg_orders, agg_spend, agg_last_date)
            on conflict (name_key) do update set
                total_orders = excluded.total_orders,
                lifetime_spend = excluded.lifetime_spend,
                last_order_date = excluded.last_order_date;
        else
            update public.pazings_customers
            set total_orders = 0,
                lifetime_spend = 0,
                last_order_date = null
            where name_key = target_key;
        end if;
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists pazings_transaction_customer_stats on public.pazings_transactions;
create trigger pazings_transaction_customer_stats
    after insert or update or delete on public.pazings_transactions
    for each row execute function public.pazings_record_customer_order();

alter table public.pazings_profiles enable row level security;
alter table public.pazings_pin_login_limits enable row level security;
alter table public.pazings_services enable row level security;
alter table public.pazings_transactions enable row level security;
alter table public.pazings_expenses enable row level security;
alter table public.pazings_customers enable row level security;
alter table public.pazings_transaction_counters enable row level security;

revoke all on public.pazings_profiles from anon, authenticated;
revoke all on public.pazings_pin_login_limits from anon, authenticated;
revoke all on public.pazings_services from anon, authenticated;
revoke all on public.pazings_transactions from anon, authenticated;
revoke all on public.pazings_expenses from anon, authenticated;
revoke all on public.pazings_customers from anon, authenticated;
revoke all on public.pazings_transaction_counters from anon, authenticated;
grant all on public.pazings_profiles to service_role;
grant all on public.pazings_pin_login_limits to service_role;
grant all on public.pazings_services to service_role;
grant all on public.pazings_transactions to service_role;
grant all on public.pazings_expenses to service_role;
grant all on public.pazings_customers to service_role;
grant all on public.pazings_transaction_counters to service_role;
grant usage, select on sequence public.pazings_customers_id_seq to service_role;
revoke execute on function public.pazings_next_transaction_code(text, date) from public, anon, authenticated;
revoke execute on function public.pazings_service_is_referenced(text) from public, anon, authenticated;
revoke execute on function public.pazings_save_rates(jsonb) from public, anon, authenticated;
revoke execute on function public.pazings_create_profile() from public, anon, authenticated;
revoke execute on function public.pazings_record_customer_order() from public, anon, authenticated;
revoke execute on function public.pazings_pin_login_allowed(text, boolean) from public, anon, authenticated;
grant execute on function public.pazings_next_transaction_code(text, date) to service_role;
grant execute on function public.pazings_service_is_referenced(text) to service_role;
grant execute on function public.pazings_save_rates(jsonb) to service_role;
grant execute on function public.pazings_pin_login_allowed(text, boolean) to service_role;

insert into public.pazings_services
    (id, category, service_code, service_name, default_rate, unit_label, display_order)
values
    ('srv_water_refill', 'water', 'refill', 'Refill', 30.00, 'bottles', 1),
    ('srv_water_delivered', 'water', 'delivered', 'Delivered', 35.00, 'bottles', 2),
    ('srv_water_gallon_refill', 'water', 'gallon_refill', 'Gallon w/ Refill', 210.00, 'gallons', 3),
    ('srv_water_gallon_cover', 'water', 'gallon_cover', 'Round Gallon Cover', 15.00, 'pcs', 4),
    ('srv_water_half_gallon', 'water', 'half_gallon', 'Half Gallon Refill', 15.00, 'bottles', 5),
    ('srv_laundry_regular', 'laundry', 'regular', 'Regular', 175.00, 'loads', 1),
    ('srv_laundry_special', 'laundry', 'special', 'Special', 205.00, 'loads', 2),
    ('srv_laundry_comforter', 'laundry', 'comforter', 'Comforter', 235.00, 'loads', 3),
    ('srv_laundry_detergent', 'laundry', 'detergent', 'Detergent', 10.00, 'packs', 4),
    ('srv_laundry_fabcon', 'laundry', 'fabcon', 'Fab Con', 10.00, 'packs', 5)
on conflict (id) do nothing;
