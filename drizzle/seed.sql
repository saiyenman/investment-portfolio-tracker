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
--
-- `description` : ce qu'affiche l'icône d'explication sur /rebalance. Elle est
-- portée par la ligne et non par une table de correspondance dans le code, car
-- la nomenclature est dynamique — une classe créée depuis /settings doit
-- pouvoir avoir la sienne, et un renommage ne doit pas faire disparaître le
-- texte. Ce sont des définitions, pas des conseils : aucune allocation n'est
-- suggérée nulle part dans l'application.
insert into public.asset_classes (name, color, sort_order, description) values
  ('Liquidités / Sécurisé', 'chart-1', 1,
   'Capital disponible à tout moment et sans risque de perte : livrets réglementés, fonds euro, comptes à terme. Le rendement est faible et peut passer sous l''inflation, ce qui érode le pouvoir d''achat sur longue période.'),
  ('Actions',               'chart-2', 2,
   'Parts d''entreprises cotées, le plus souvent détenues via un fonds indiciel qui réplique un indice (MSCI World, S&P 500…). Historiquement la classe la plus rémunératrice sur plusieurs décennies, avec des baisses de 30 à 50 % survenues à plusieurs reprises en cours de route.'),
  ('Immobilier',            'chart-3', 3,
   'Immobilier détenu en direct ou via des parts : SCPI, SCI, foncières cotées. Verse des revenus locatifs réguliers. Frais d''entrée élevés et revente lente — pour une SCPI, c''est la valeur de retrait qui compte, environ 10 % sous le prix de souscription.'),
  ('Matières premières',    'chart-4', 4,
   'Or, métaux et énergie, le plus souvent via un ETC adossé au métal physique. Ne produit ni intérêt ni dividende : la performance vient uniquement du prix. Évolue souvent à contretemps des actions.')
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
