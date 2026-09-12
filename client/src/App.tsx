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
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/login"} component={Login} />
      <Route path={"/subjects"} component={Subjects} />
      <Route path={"/planner"} component={Planner} />
      <Route path={"/chat"} component={Chat} />
      <Route path={"/documents"} component={Documents} />
      <Route path={"/practice"} component={Practice} />
      <Route path={"/research"} component={Research} />
      <Route path={"/notes"} component={Notes} />
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
