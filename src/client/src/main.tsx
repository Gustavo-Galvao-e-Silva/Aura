import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import {ClerkProvider, Show, RedirectToSignIn } from "@clerk/react-router";
import "./index.css";
import FinGlobalLandingPage from "./pages/LandingPage";
import FinGlobalLoginPage from "./pages/Login";
import FinGlobalRegisterPage from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ExpensesPage from "./pages/Expenses";
import RouteOptimizer from "./pages/RouteOptimizer";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <Routes>
        <Route path="/" element={<FinGlobalLandingPage />} />
        <Route path="/register" element={<FinGlobalRegisterPage />} />
        <Route path="/login" element={<FinGlobalLoginPage />} />

        <Route
          path="/dashboard"
          element={
            <Show when="signed-in" fallback={<RedirectToSignIn />}>
              <Dashboard />
            </Show>
          }
        />

        <Route
          path="/expenses"
          element={
            <Show when="signed-in" fallback={<RedirectToSignIn />}>
              <ExpensesPage/>
            </Show>
          }
        />

        <Route
          path="/routes"
          element={
            <Show when="signed-in" fallback={<RedirectToSignIn />}>
              <RouteOptimizer/>
            </Show>
          }
        />

      </Routes>      
    </ClerkProvider>
  </BrowserRouter>
);