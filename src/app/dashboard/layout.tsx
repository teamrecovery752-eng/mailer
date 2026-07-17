import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NextAuthSessionProvider from "@/components/SessionProvider";
import { ToastProvider } from "@/components/Toast";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <NextAuthSessionProvider>
      <ToastProvider>
        <div style={{ display: "flex", minHeight: "100vh", background: "#0c0c0f" }}>
          <Sidebar />
          <main style={{ flex: 1, marginLeft: 240, minHeight: "100vh" }}>
            <div style={{ padding: 32 }}>{children}</div>
          </main>
        </div>
      </ToastProvider>
    </NextAuthSessionProvider>
  );
}
