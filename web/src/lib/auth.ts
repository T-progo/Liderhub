import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Perfil } from "./types";

// Current user + profile, or redirect to /login. Use at the top of every protected page.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfis").select("*").eq("id", user.id).single<Perfil>();
  if (!perfil || !perfil.ativo) redirect("/login?erro=inativo");
  return { supabase, user, perfil };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.perfil.papel !== "admin") redirect("/contratos");
  return ctx;
}
