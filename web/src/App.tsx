import { AttackModal } from "./components/AttackModal";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { useRoute } from "./lib/router";
import { StoreProvider } from "./lib/store";
import { InspectorPage, LogsPage, OverviewPage, RateLimitPage, SecurityPage, SettingsPage, StaffPage, TlsPage } from "./pages";

function Page() {
  switch (useRoute()) {
    case "/inspector": return <InspectorPage />;
    case "/security": return <SecurityPage />;
    case "/rate-limiting": return <RateLimitPage />;
    case "/tls": return <TlsPage />;
    case "/staff": return <StaffPage />;
    case "/logs": return <LogsPage />;
    case "/settings": return <SettingsPage />;
    default: return <OverviewPage />;
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Sidebar />
      <div className="min-w-0 lg:pl-[212px]">
        <Topbar />
        <main className="mx-auto max-w-[1680px] px-4 pt-3 pb-8 lg:px-5">
          <Page />
        </main>
      </div>
      <AttackModal />
    </StoreProvider>
  );
}
