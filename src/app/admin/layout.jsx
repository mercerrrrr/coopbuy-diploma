import { getSession } from "@/lib/auth";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({ children }) {
  const session = await getSession();
  const role = session?.role ?? "ADMIN";

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={role} />
      <div className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
