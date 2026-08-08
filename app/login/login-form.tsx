"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { signIn, type SignInState } from "./actions";

const INITIAL: SignInState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={state.error ? true : undefined}>
          <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            aria-invalid={state.error ? true : undefined}
          />
        </Field>

        <Field data-invalid={state.error ? true : undefined}>
          <FieldLabel htmlFor="password">Mot de passe (pass user Supabase)</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={state.error ? true : undefined}
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Se connecter
        </Button>
      </FieldGroup>
    </form>
  );
}
