import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSignIn } from "@clerk/react-router/legacy";
import { Eye, EyeOff, Lock, LogIn, Mail, MoveLeft, Wallet } from "lucide-react";

const C = {
  bg: "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  surfaceStrong: "rgba(63,79,68,0.28)",
  border: "rgba(162,123,92,0.18)",
  rose: "#A27B5C",
  cream: "#DCD7C9",
  muted: "rgba(220,215,201,0.50)",
  mutedStrong: "rgba(220,215,201,0.72)",
  danger: "#f87171",
};

export default function FinGlobalLoginPage() {
  const navigate = useNavigate();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isLoaded) return;

    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/dashboard");
      } else {
        setError(`Sign-in not complete. Current status: ${result.status}`);
      }
    } catch (err: any) {
      const clerkError =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Something went wrong while signing in.";

      setError(clerkError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{ backgroundColor: C.bg, color: C.cream }}
      className="h-screen overflow-hidden"
    >
      <div className="flex h-full flex-col">
        <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-4">
          <div className="flex w-full max-w-[480px] flex-col">
            <Link
              className="mb-4 flex items-center gap-2 self-start text-sm font-medium transition-colors"
              style={{ color: C.mutedStrong }}
              to="/"
            >
              <MoveLeft className="h-4 w-4" />
              Back to home
            </Link>

            <div
              className="flex w-full flex-col overflow-hidden rounded-xl shadow-xl"
              style={{
                backgroundColor: C.surface,
                border: `1px solid ${C.border}`,
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="relative h-40 w-full overflow-hidden" style={{ backgroundColor: C.surfaceStrong }}>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCtmt3HY53_RY2k5KCA-M3vSz7CDGk3X_WhIjY8LQDymCYCEdTV1yGrmeM4Mk_vsZXkeeQv40TTGSBc-s0CVhs0lj--6i_Q9UyVIwiIO1SodxhyRRA1X-5FylBECQ9afJydn9H9OSB-CCMJY4g6o7Ot6H18Cu-Omk_3Et7uSFY0XrGuydz6wCD5ecdig16w7_VppAEH2oHocQ5JT6HLc32caziOileWxJrC_75Mg4HySkgQvBBh84SpDrLxk2qKwXNxVraEErs3-Wg6')",
                  }}
                  aria-label="Cheerful college students studying together on campus"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to top, ${C.bg}, transparent)`,
                  }}
                />
              </div>

              <div className="flex flex-col gap-5 px-8 pt-4 pb-6">
                <Link
                  className="mb-1 flex items-center gap-2 transition-opacity hover:opacity-80"
                  to="/"
                >
                  <div style={{ color: C.rose }}>
                    <Wallet className="h-9 w-9" />
                  </div>
                  <h1
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: C.cream }}
                  >
                    Revellio
                  </h1>
                </Link>

                <div className="flex flex-col gap-1">
                  <h2
                    className="text-3xl font-black leading-tight tracking-tight"
                    style={{ color: C.cream }}
                  >
                    Welcome back
                  </h2>
                  <p style={{ color: C.muted }} className="text-base">
                    Manage your student finances with ease.
                  </p>
                </div>

                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-2">
                    <label
                      className="text-sm font-semibold"
                      style={{ color: C.mutedStrong }}
                    >
                      Email
                    </label>
                    <div className="relative">
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
                        style={{ color: C.muted }}
                      >
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        className="h-12 w-full rounded-lg pl-10 text-sm outline-none transition-colors"
                        style={{
                          backgroundColor: C.surfaceStrong,
                          border: `1px solid ${C.border}`,
                          color: C.cream,
                        }}
                        placeholder="Enter your student email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.rose)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-sm font-semibold"
                        style={{ color: C.mutedStrong }}
                      >
                        Password
                      </label>
                      <Link
                        className="text-sm font-medium hover:underline"
                        style={{ color: C.rose }}
                        to="/forgot-password"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <div className="relative">
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
                        style={{ color: C.muted }}
                      >
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        className="h-12 w-full rounded-lg pl-10 pr-10 text-sm outline-none transition-colors"
                        style={{
                          backgroundColor: C.surfaceStrong,
                          border: `1px solid ${C.border}`,
                          color: C.cream,
                        }}
                        placeholder="Enter your password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.rose)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
                        style={{ color: C.muted }}
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="rounded-lg px-3 py-2 text-sm"
                      style={{
                        backgroundColor: "rgba(248,113,113,0.10)",
                        border: `1px solid rgba(248,113,113,0.25)`,
                        color: C.danger,
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <button
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-bold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: C.rose, color: C.cream }}
                    type="submit"
                    disabled={!isLoaded || isSubmitting}
                  >
                    {isSubmitting ? "Signing in..." : "Log In"}
                    {!isSubmitting && <LogIn className="h-4 w-4" />}
                  </button>
                </form>

                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full" style={{ borderTop: `1px solid ${C.border}` }} />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span
                      className="px-2"
                      style={{ backgroundColor: C.bg, color: C.muted }}
                    >
                      New to Revellio?
                    </span>
                  </div>
                </div>

                <Link
                  to="/register"
                  className="flex w-full items-center justify-center rounded-lg px-4 py-3 font-bold transition-colors"
                  style={{
                    backgroundColor: C.surfaceStrong,
                    border: `1px solid ${C.border}`,
                    color: C.rose,
                  }}
                >
                  Create an account
                </Link>

                <div className="text-center">
                  <p className="text-xs" style={{ color: C.muted }}>
                    Protected by secure bank-grade encryption.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
