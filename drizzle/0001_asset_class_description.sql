-- ─────────────────────────────────────────────────────────────────────────
-- Description des classes d'actifs.
--
-- La nomenclature est dynamique : le code ne connaît aucune classe par son
-- nom. Une table de correspondance figée dans le code ne dirait donc rien
-- d'une classe créée depuis /settings, et perdrait son texte au premier
-- renommage. La description appartient à la ligne.
--
-- Colonne `text` nullable et sans valeur par défaut : Postgres se contente
-- d'écrire le catalogue, sans réécrire la table ni ses index. Pas d'index
-- non plus — on ne filtre jamais dessus, elle n'est lue que par id.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.asset_classes
  add column if not exists description text;

-- Rattrapage des classes déjà en base. `where description is null` rend le
-- script rejouable et ne réécrit jamais un texte saisi depuis /settings.
update public.asset_classes as c
set description = v.description
from (values
  ('Liquidités / Sécurisé',
   'Capital disponible à tout moment et sans risque de perte : livrets réglementés, fonds euro, comptes à terme. Le rendement est faible et peut passer sous l''inflation, ce qui érode le pouvoir d''achat sur longue période.'),
  ('ETF Actions',
   'Parts d''entreprises cotées, détenues via un fonds indiciel qui réplique un indice (MSCI World, S&P 500…). Historiquement la classe la plus rémunératrice sur plusieurs décennies, avec des baisses de 30 à 50 % survenues à plusieurs reprises en cours de route.'),
  ('Immobilier',
   'Immobilier détenu en direct ou via des parts : SCPI, SCI, foncières cotées. Verse des revenus locatifs réguliers. Frais d''entrée élevés et revente lente — pour une SCPI, c''est la valeur de retrait qui compte, environ 10 % sous le prix de souscription.'),
  ('Matières premières',
   'Or, métaux et énergie, le plus souvent via un ETC adossé au métal physique. Ne produit ni intérêt ni dividende : la performance vient uniquement du prix. Évolue souvent à contretemps des actions.'),
  ('Crypto',
   'Actifs numériques : bitcoin, ether et autres. Volatilité très supérieure aux actions, pas de rendement distribué, aucune garantie des dépôts et un cadre réglementaire encore mouvant.')
) as v(name, description)
where c.name = v.name
  and c.description is null;
