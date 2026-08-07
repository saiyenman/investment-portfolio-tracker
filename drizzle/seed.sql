-- ─────────────────────────────────────────────────────────────────────────
-- Seed de la nomenclature initiale.
--
-- Idempotent : chaque insert est protégé par ON CONFLICT DO NOTHING, le
-- script peut donc être rejoué sans créer de doublon ni écraser une
-- personnalisation faite depuis l'interface.
--
-- `color` stocke un slot de la palette catégorielle validée (chart-1 …
-- chart-8) plutôt qu'un hex : le thème clair et le thème sombre ont chacun
-- leur valeur, définies dans app/globals.css. Stocker un hex figerait un
-- seul des deux modes.
--
-- Aucune allocation cible n'est seedée : elle relève d'une décision
-- d'investissement personnelle, à saisir depuis /rebalance.
-- ─────────────────────────────────────────────────────────────────────────

-- Niveau 1 — enveloppes fiscales
insert into public.envelopes (name, color, ceiling_amount, sort_order) values
  ('Livret A',      'chart-1', 22950.00, 1),
  ('PEA',           'chart-2', null,     2),
  ('Assurance-Vie', 'chart-3', null,     3)
on conflict (name) do nothing;

-- Niveau 2 — classes d'actifs
insert into public.asset_classes (name, color, sort_order) values
  ('Liquidités / Sécurisé', 'chart-1', 1),
  ('Actions',               'chart-2', 2),
  ('Immobilier',            'chart-3', 3),
  ('Matières premières',    'chart-4', 4)
on conflict (name) do nothing;

-- Niveau 3 — lignes de portefeuille (support × enveloppe)
-- input_mode AMOUNT : on saisit un montant en euros, le prix est figé à 1.
-- input_mode QUANTITY : on saisit des parts et un cours.
insert into public.holdings
  (envelope_id, asset_class_id, name, isin, input_mode, sort_order, note)
select e.id, c.id, v.name, v.isin, v.input_mode, v.sort_order, v.note
from (values
  ('Livret A',      'Liquidités / Sécurisé', 'Livret A',
   null::text, 'AMOUNT', 1,
   null::text),
  ('Assurance-Vie', 'Liquidités / Sécurisé', 'Fonds Euro Nouvelle Génération',
   null, 'AMOUNT', 2,
   'Intérêts annuels : augmenter le montant à la date de capitalisation.'),
  ('PEA',           'Actions',               'ETF MSCI World',
   null, 'QUANTITY', 3,
   null),
  ('PEA',           'Actions',               'ETF S&P 500',
   null, 'QUANTITY', 4,
   null),
  ('Assurance-Vie', 'Matières premières',    'Amundi Physical Gold ETC C',
   'FR0013416716', 'QUANTITY', 5,
   null),
  ('Assurance-Vie', 'Immobilier',            'SCPI',
   null, 'QUANTITY', 6,
   'Saisir la VALEUR DE RETRAIT, pas le prix de souscription : c''est ce que vaut la part à la revente (environ -10 %).')
) as v(envelope, asset_class, name, isin, input_mode, sort_order, note)
join public.envelopes     e on e.name = v.envelope
join public.asset_classes c on c.name = v.asset_class
on conflict (envelope_id, name) do nothing;
