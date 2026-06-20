import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defesa em profundidade — o proxy já bloqueia, mas garantimos aqui também
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>;
}
