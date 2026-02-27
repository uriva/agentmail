import { useAuth, auth } from "./db.ts";

const Header = () => {
  const { user } = useAuth();

  return (
    <header class="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" class="text-lg font-semibold text-white tracking-tight">
          AgentMail
        </a>
        <div class="flex items-center gap-4">
          {user ? (
            <>
              <span class="text-sm text-slate-400">{user.email}</span>
              <button
                onClick={() => auth.signOut()}
                class="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              href="/login"
              class="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
};

export { Header };
