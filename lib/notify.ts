"use client";

import { toast } from "@/components/ui/toast";

/**
 * Raccourcis de notification.
 *
 * Le gestionnaire de toasts de Base UI expose `add({ title, type })` et non
 * des méthodes `success()` / `error()` : ce module évite d'éparpiller cette
 * forme dans tous les composants.
 */
export const notify = {
  success: (title: string, description?: string) =>
    toast.add({ title, description, type: "success" }),
  error: (title: string, description?: string) =>
    toast.add({ title, description, type: "error" }),
  info: (title: string, description?: string) =>
    toast.add({ title, description, type: "info" }),
};
