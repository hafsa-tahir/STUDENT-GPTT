import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/pages/Chat";
import Documents from "@/pages/Documents";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Planner from "@/pages/Planner";
import Practice from "@/pages/Practice";
import Research from "@/pages/Research";
import Notes from "@/pages/Notes";
import Subjects from "@/pages/Subjects";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { AppLoading } from "@/components/StudentAppShell";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return <AppLoading />;
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"} component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path={"/subjects"} component={() => <ProtectedRoute component={Subjects} />} />
      <Route path={"/planner"} component={() => <ProtectedRoute component={Planner} />} />
      <Route path={"/chat"} component={() => <ProtectedRoute component={Chat} />} />
      <Route path={"/documents"} component={() => <ProtectedRoute component={Documents} />} />
      <Route path={"/practice"} component={() => <ProtectedRoute component={Practice} />} />
      <Route path={"/research"} component={() => <ProtectedRoute component={Research} />} />
      <Route path={"/notes"} component={() => <ProtectedRoute component={Notes} />} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <SupabaseAuthProvider>
            <Toaster />
            <Router />
          </SupabaseAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
