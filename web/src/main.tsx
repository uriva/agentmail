import { render } from "preact";
import {
  LocationProvider,
  Router,
  Route,
  ErrorBoundary,
} from "preact-iso";
import { Login } from "./login.tsx";
import { Dashboard } from "./dashboard.tsx";
import { Landing } from "./landing.tsx";
import { Header } from "./header.tsx";
import { useAuth } from "./db.ts";

const NotFound = () => (
  <div class="flex items-center justify-center h-full">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-slate-300 mb-2">404</h1>
      <p class="text-slate-500">Page not found</p>
    </div>
  </div>
);

const Home = () => {
  const { isLoading, error, user } = useAuth();
  if (isLoading) {
    return (
      <div class="flex items-center justify-center h-64">
        <div class="text-slate-400">Loading...</div>
      </div>
    );
  }
  if (error || !user) return <Landing />;
  return <Dashboard />;
};

const App = () => (
  <LocationProvider>
    <ErrorBoundary>
      <div class="min-h-full flex flex-col">
        <Header />
        <main class="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <Router>
            <Route path="/" component={Home} />
            <Route path="/login" component={Login} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </div>
    </ErrorBoundary>
  </LocationProvider>
);

render(<App />, document.getElementById("root")!);
