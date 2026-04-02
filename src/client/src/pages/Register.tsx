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
} from "lucide-react";
import UserClient, { type CreateUserPayload } from "../API/UserClient";
import createUser from "../API/UserClient";

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

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) {
  const { icon, ...rest } = props;
  return (
    <div className="relative">
      {icon && (
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: C.muted }}
        >
          {icon}
        </span>
      )}
      <input
        className="w-full rounded-lg py-3 pr-4 outline-none transition-colors"
        style={{
          backgroundColor: C.surfaceStrong,
          border: `1px solid ${C.border}`,
          color: C.cream,
          paddingLeft: icon ? "2.5rem" : "1rem",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = C.rose)}
        onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
        {...rest}
      />
    </div>
  );
}

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
      createUser({ fullName: fullName, email: email, username: username } as CreateUserPayload);
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

      {/*
        console.log("status:", completeSignUp.status);
        console.log("missingFields:", completeSignUp.missingFields);
        console.log("requiredFields:", completeSignUp.requiredFields);
        console.log("unverifiedFields:", completeSignUp.unverifiedFields);
      */}

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        navigate("/dashboard");
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
    <div
      className="flex min-h-screen flex-col font-sans"
      style={{ backgroundColor: C.bg, color: C.cream }}
    >
      <header
        className="sticky top-0 z-50 flex w-full items-center justify-between px-6 py-4 backdrop-blur-md"
        style={{
          borderBottom: `1px solid ${C.border}`,
          backgroundColor: "rgba(44,57,48,0.85)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg">
            <img className="min-w-[40px] h-[50px]" src="logo.png" />
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: C.cream }}>
            Revellio
          </h1>
        </div>

        <Link
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: C.mutedStrong }}
          to="/"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div
            className="overflow-hidden rounded-xl shadow-xl"
            style={{
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              className="flex h-32 items-end p-6"
              style={{
                background: `linear-gradient(to bottom right, ${C.rose}, rgba(162,123,92,0.6))`,
              }}
            >
              <h2 className="text-2xl font-bold" style={{ color: C.cream }}>
                {pendingVerification ? "Verify your email" : "Create Account"}
              </h2>
            </div>

            <div className="p-8">
              {!pendingVerification ? (
                <>
                  <p className="mb-8 text-sm" style={{ color: C.muted }}>
                    Join Revellio to manage your student finances, track loans,
                    and plan your budget.
                  </p>

                  <form className="space-y-5" onSubmit={handleRegister}>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold" style={{ color: C.mutedStrong }}>
                        Full Name
                      </label>
                      <StyledInput
                        icon={<User className="h-5 w-5" />}
                        placeholder="John Doe"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold" style={{ color: C.mutedStrong }}>
                        Username
                      </label>
                      <StyledInput
                        icon={<CircleUser className="h-5 w-5" />}
                        placeholder="johndoe"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold" style={{ color: C.mutedStrong }}>
                        Email
                      </label>
                      <StyledInput
                        icon={<Mail className="h-5 w-5" />}
                        placeholder="name@university.edu"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold" style={{ color: C.mutedStrong }}>
                          Password
                        </label>
                        <StyledInput
                          icon={<Lock className="h-5 w-5" />}
                          placeholder="••••••••"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold" style={{ color: C.mutedStrong }}>
                          Confirm
                        </label>
                        <StyledInput
                          icon={<Lock className="h-5 w-5" />}
                          placeholder="••••••••"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                    </div>

                    <div id="clerk-captcha" />

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
                      className="flex w-full items-center justify-center gap-2 rounded-lg py-4 font-bold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: C.rose, color: C.cream }}
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
                  <p className="mb-8 text-sm" style={{ color: C.muted }}>
                    We sent a verification code to{" "}
                    <span className="font-semibold" style={{ color: C.cream }}>{email}</span>.
                    Enter it below to finish creating your account.
                  </p>

                  <form className="space-y-5" onSubmit={handleVerify}>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold" style={{ color: C.mutedStrong }}>
                        Verification code
                      </label>
                      <StyledInput
                        placeholder="123456"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        inputMode="numeric"
                        required
                      />
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
                      className="flex w-full items-center justify-center gap-2 rounded-lg py-4 font-bold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: C.rose, color: C.cream }}
                      type="submit"
                      disabled={!isLoaded || isSubmitting}
                    >
                      {isSubmitting ? "Verifying..." : "Verify Email"}
                    </button>
                  </form>
                </>
              )}

              <div
                className="mt-8 pt-6 text-center"
                style={{ borderTop: `1px solid ${C.border}` }}
              >
                <p className="text-sm" style={{ color: C.mutedStrong }}>
                  Already have an account?{" "}
                  <Link
                    className="font-semibold hover:underline"
                    style={{ color: C.rose }}
                    to="/login"
                  >
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
