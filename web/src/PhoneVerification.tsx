import { useState } from "preact/hooks";

// @ts-ignore: Vite injects import.meta.env at build time
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "";

export const PhoneVerification = ({
  userToken,
  onVerified,
}: {
  userToken: string;
  onVerified: () => void;
}) => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendPhoneCode = async () => {
    if (!phone || phone.trim().length < 7) {
      setError("Please enter a valid phone number (e.g. +1234567890)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/phone/send-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send SMS code");
      }
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send SMS code");
    }
    setLoading(false);
  };

  const verifyPhoneCode = async () => {
    if (!code || code.trim().length < 4) {
      setError("Please enter the verification code sent to your phone");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/phone/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code");
      }
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    }
    setLoading(false);
  };

  return (
    <div class="flex items-center justify-center min-h-[60vh]">
      <div class="w-full max-w-sm bg-slate-800 rounded-xl p-8 border border-slate-700">
        <div class="flex items-center space-x-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg">
            📱
          </div>
          <div>
            <h1 class="text-xl font-bold text-white">Phone Verification</h1>
            <p class="text-xs text-slate-400">Required to secure your account</p>
          </div>
        </div>

        {error && (
          <div class="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {step === "phone" ? (
          <div>
            <label class="block text-sm text-slate-300 mb-1">
              Mobile Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
              placeholder="+1234567890"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-4"
              onKeyDown={(e) => e.key === "Enter" && sendPhoneCode()}
            />
            <p class="text-xs text-slate-400 mb-4">
              Enter your mobile phone number with country code (e.g. +1 for US/Canada).
            </p>
            <button
              onClick={sendPhoneCode}
              disabled={loading || !phone}
              class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? "Sending SMS..." : "Send Verification Code"}
            </button>
          </div>
        ) : (
          <div>
            <p class="text-slate-400 text-sm mb-4">
              We sent a verification code to <span class="text-white">{phone}</span>
            </p>
            <label class="block text-sm text-slate-300 mb-1">SMS Verification Code</label>
            <input
              type="text"
              value={code}
              onInput={(e) => setCode((e.target as HTMLInputElement).value)}
              placeholder="123456"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-4 text-center text-2xl tracking-widest"
              onKeyDown={(e) => e.key === "Enter" && verifyPhoneCode()}
            />
            <button
              onClick={verifyPhoneCode}
              disabled={loading || !code}
              class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? "Verifying..." : "Verify Phone Number"}
            </button>
            <button
              onClick={() => {
                setStep("phone");
                setCode("");
              }}
              class="w-full mt-2 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Use a different phone number
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
