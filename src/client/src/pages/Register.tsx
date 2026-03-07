import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSignUp } from "@clerk/react-router/legacy";
import {
  ArrowLeft,
  CircleUser,
  Lock,
  LogIn,
  Mail,
  User,
  Wallet,
} from "lucide-react";

export default function FinGlobalRegisterPage() {
  const navigate = useNavigate();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  const [pendingVerification, setPendingVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isLoaded) return;

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const [firstName = "", ...rest] = fullName.trim().split(" ");
      const lastName = rest.join(" ");

      await signUp.create({
        emailAddress: email,
        password,
        username,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setPendingVerification(true);
    } catch (err: any) {
      const clerkError =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Something went wrong while creating your account.";

      setError(clerkError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isLoaded) return;

    setError("");
    setIsSubmitting(true);

    try {

      const completeSignUp = await signUp.attemptEmailAddressVerification({
         code,
       });

        console.log("status:", completeSignUp.status);
        console.log("missingFields:", completeSignUp.missingFields);
        console.log("requiredFields:", completeSignUp.requiredFields);
        console.log("unverifiedFields:", completeSignUp.unverifiedFields);

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        navigate("/");
      } else {
        setError(
          `Verification not complete. Current status: ${completeSignUp.status}`
        );
      }
    } catch (err: any) {
      const clerkError =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Invalid verification code.";

      setError(clerkError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex items-center gap-2 text-blue-700">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-700 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Thea.do
          </h1>
        </div>

        <Link
          className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-400"
          to="/"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-32 items-end bg-gradient-to-br from-blue-700 to-blue-600 p-6">
              <h2 className="text-2xl font-bold text-white">
                {pendingVerification ? "Verify your email" : "Create Account"}
              </h2>
            </div>

            <div className="p-8">
              {!pendingVerification ? (
                <>
                  <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
                    Join Thea.do to manage your student finances, track loans,
                    and plan your budget.
                  </p>

                  <form className="space-y-5" onSubmit={handleRegister}>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Full Name
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <User className="h-5 w-5" />
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                          placeholder="John Doe"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          autoComplete="name"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Username
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <CircleUser className="h-5 w-5" />
                            </span>
                            <input
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                            placeholder="johndoe"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Email
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail className="h-5 w-5" />
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                          placeholder="name@university.edu"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Password
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Lock className="h-5 w-5" />
                          </span>
                          <input
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                            placeholder="••••••••"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Confirm
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Lock className="h-5 w-5" />
                          </span>
                          <input
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                            placeholder="••••••••"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div id="clerk-captcha" />

                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                      </div>
                    )}

                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-4 font-bold text-white transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                      type="submit"
                      disabled={!isLoaded || isSubmitting}
                    >
                      {isSubmitting ? "Creating account..." : "Create Account"}
                      {!isSubmitting && <LogIn className="h-4 w-4" />}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
                    We sent a verification code to <span className="font-semibold">{email}</span>.
                    Enter it below to finish creating your account.
                  </p>

                  <form className="space-y-5" onSubmit={handleVerify}>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Verification code
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 px-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                        placeholder="123456"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        inputMode="numeric"
                        required
                      />
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                      </div>
                    )}

                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-4 font-bold text-white transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                      type="submit"
                      disabled={!isLoaded || isSubmitting}
                    >
                      {isSubmitting ? "Verifying..." : "Verify Email"}
                    </button>
                  </form>
                </>
              )}

              <div className="mt-8 border-t border-slate-100 pt-6 text-center dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Already have an account?{" "}
                  <Link className="font-semibold text-blue-700 hover:underline" to="/login">
                    Log in
                  </Link>
                </p>
              </div>
            </div>
          </div>


        </div>
      </main>
    </div>
  );
}