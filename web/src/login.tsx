import { useState } from "preact/hooks";
import { auth } from "./db.ts";

const ALLOWED_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "ymail.com",
  "protonmail.com",
  "proton.me",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "pm.me",
  "tutanota.com",
  "tuta.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "qq.com",
  "163.com",
  "126.com",
]);

const isAllowedEmail = (email: string): boolean => {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return ALLOWED_DOMAINS.has(domain);
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!isAllowedEmail(email)) {
      setError(
        "Please use a personal email (Gmail, Outlook, Yahoo, ProtonMail, iCloud, etc.)",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      await auth.sendMagicCode({ email });
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    }
    setLoading(false);
  };

  const verifyCode = async () => {
    setLoading(true);
    setError("");
    try {
      await auth.signInWithMagicCode({ email, code });
      window.location.href = "/app";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    }
    setLoading(false);
  };

  return (
    <div class="flex items-center justify-center min-h-[60vh]">
      <div class="w-full max-w-sm bg-slate-800 rounded-xl p-8 border border-slate-700">
        <h1 class="text-2xl font-bold text-white mb-2">Sign in</h1>
        <p class="text-slate-400 text-sm mb-6">
          Access your AgentMail dashboard
        </p>

        {error && (
          <div class="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {step === "email" ? (
          <div>
            <label class="block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="you@company.com"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-4"
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
            />
            <button
              onClick={sendCode}
              disabled={loading || !email}
              class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? "Sending..." : "Send login code"}
            </button>
          </div>
        ) : (
          <div>
            <p class="text-slate-400 text-sm mb-4">
              We sent a code to <span class="text-white">{email}</span>
            </p>
            <label class="block text-sm text-slate-300 mb-1">Code</label>
            <input
              type="text"
              value={code}
              onInput={(e) => setCode((e.target as HTMLInputElement).value)}
              placeholder="123456"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-4 text-center text-2xl tracking-widest"
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
            />
            <button
              onClick={verifyCode}
              disabled={loading || !code}
              class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              onClick={() => {
                setStep("email");
                setCode("");
              }}
              class="w-full mt-2 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export { Login };
