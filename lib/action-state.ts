/**
 * État de retour commun aux Server Actions.
 *
 * Ce module existe pour une contrainte de React : un fichier marqué
 * `"use server"` ne peut exporter QUE des fonctions asynchrones. Y exporter
 * une constante comme `IDLE` lève « A "use server" file can only export async
 * functions, found object » — et seulement à l'évaluation du module, pas à la
 * compilation, donc `next build` ne l'attrape pas.
 *
 * Les types, eux, sont effacés à la compilation et pourraient rester dans les
 * fichiers d'actions ; ils sont regroupés ici par cohérence.
 */

export type ActionState = {
  error: string | null;
  ok: boolean;
  /**
   * Horodatage du résultat. Sans lui, deux succès identiques produiraient le
   * même objet d'état et le client ne déclencherait aucun effet la seconde
   * fois : la boîte de dialogue resterait ouverte, le toast ne s'afficherait
   * pas.
   */
  at: number;
};

export const IDLE: ActionState = { error: null, ok: false, at: 0 };

export const actionSuccess = (): ActionState => ({
  error: null,
  ok: true,
  at: Date.now(),
});

export const actionFailure = (error: string): ActionState => ({
  error,
  ok: false,
  at: Date.now(),
});
