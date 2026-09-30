import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Perfil } from "./types";

// Current user + profile, or redirect to /login. Use at the top of every protected page.
// getClaims() verifies the session JWT locally (asymmetric signing keys), without a call to the
// Auth server; cache() makes the layout and the page share one check per request.
// Deactivated users are blocked by perfis.ativo, checked here on every request.
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (!id) redirect("/login");

  const { data: perfil } = await supabase.from("perfis").select("*").eq("id", id).single<Perfil>();
  if (!perfil || !perfil.ativo) redirect("/login?erro=inativo");
  return { supabase, user: { id, email: data.claims.email }, perfil };
});

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.perfil.papel !== "admin") redirect("/contratos");
  return ctx;
}
