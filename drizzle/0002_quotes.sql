-- ─────────────────────────────────────────────────────────────────────────
-- Cours de marché — récupération automatique chez Yahoo Finance.
--
-- Deux objets : le symbole de cotation sur la ligne, et une table qui garde
-- la dernière réponse de Yahoo. Cette table est à la fois le cache — on ne
-- rappelle Yahoo que si la ligne dépasse 15 minutes — et la valeur de repli
-- quand il ne répond pas. Un cache en mémoire ne ferait ni l'un ni l'autre :
-- il ne survit ni aux redémarrages ni au passage sur une autre instance.
--
-- Les taux de change y sont stockés comme des cotations ordinaires :
-- « USDEUR=X » est une ligne parmi les autres, avec le même délai de
-- péremption. Pas de seconde table pour la même mécanique.
-- ─────────────────────────────────────────────────────────────────────────

-- Le symbole n'est PAS unique : le même ETF détenu en PEA et en CTO fait
-- deux lignes, qui pointent légitimement vers la même cotation.
alter table public.holdings
  add column if not exists quote_symbol text;

create table if not exists public.quotes (
  symbol      text primary key,
  price       numeric(20,8) not null,
  currency    text not null,
  market_time timestamptz,
  short_name  text,
  fetched_at  timestamptz not null default now()
);

-- Supabase expose toute table publique via PostgREST : sans RLS elle serait
-- lisible depuis Internet dès que la clé publiable circule. Même politique
-- que les quatre tables existantes.
alter table public.quotes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quotes'
      and policyname = 'authenticated_full_access'
  ) then
    create policy "authenticated_full_access" on public.quotes
      for all to authenticated using (true);
  end if;
end $$;

-- Les quatre lignes du CTO portaient leur ticker dans `isin`, qui attend un
-- identifiant à 12 caractères. Le symbole de cotation a maintenant sa colonne.
--
-- « CSPX » seul est refusé par Yahoo : le suffixe de place est obligatoire.
-- CSPX.L cotait 835,33 USD au moment de la migration, contre 835,60 saisi à
-- la main — la correspondance est établie, pas devinée.
update public.holdings
set quote_symbol = case isin when 'CSPX' then 'CSPX.L' else isin end,
    isin = null
where isin in ('NVDA', 'BABA', 'DIS', 'CSPX')
  and quote_symbol is null;
