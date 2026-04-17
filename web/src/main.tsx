import hydrate from "preact-iso/hydrate";
import { ErrorBoundary, LocationProvider, Route, Router } from "preact-iso";
import { Login } from "./login.tsx";
import { Dashboard } from "./dashboard.tsx";
import { Landing } from "./landing.tsx";
import { Docs } from "./docs.tsx";
import { Privacy } from "./privacy.tsx";
import { Terms } from "./terms.tsx";
import { Pricing } from "./pricing.tsx";
import { Header } from "./header.tsx";
import { useAuth } from "./db.ts";
import "./app.css";

if (typeof window !== "undefined") {
  // deno-lint-ignore no-explicit-any
  const posthogKey: string = (import.meta as any).env?.VITE_POSTHOG_KEY ?? "";
  if (posthogKey) {
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(posthogKey, {
        api_host: "https://us.i.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
      });
    });
  }
}

const NotFound = () => (
  <div class="flex items-center justify-center h-full">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-slate-300 mb-2">404</h1>
      <p class="text-slate-500">Page not found</p>
    </div>
  </div>
);

const AppPage = () => {
  const { isLoading, error, user } = useAuth();
  if (isLoading) {
    return (
      <div class="flex items-center justify-center h-64">
        <div class="text-slate-400">Loading...</div>
      </div>
    );
  }
  if (error || !user) {
    window.location.href = "/login";
    return null;
  }
  return <Dashboard />;
};

const App = () => (
  <ErrorBoundary>
    <div class="min-h-full flex flex-col">
      <Header />
      <main class="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Router>
          <Route path="/" component={Landing} />
          <Route path="/app" component={AppPage} />
          <Route path="/login" component={Login} />
          <Route path="/docs" component={Docs} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/pricing" component={Pricing} />
          <Route default component={NotFound} />
        </Router>
      </main>
    </div>
  </ErrorBoundary>
);

export const App_ = () => (
  <LocationProvider>
    <App />
  </LocationProvider>
);

if (typeof window !== "undefined") {
  hydrate(<App_ />);
}
