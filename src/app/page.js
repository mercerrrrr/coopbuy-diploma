import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminWorkspaceRole } from "@/lib/constants";

export default async function HomePage() {
  const session = await getSession();

  if (!session) redirect("/auth/login");
  if (isAdminWorkspaceRole(session.role)) redirect("/admin/dashboard");
  redirect("/my/procurements");
}
