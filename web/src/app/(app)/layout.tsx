import { requireUser } from "@/lib/auth";
import { Shell } from "./shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = await requireUser();
  return <Shell perfil={perfil}>{children}</Shell>;
}
