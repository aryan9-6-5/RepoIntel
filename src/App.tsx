import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useSearchParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import NotFound from "./pages/NotFound";

const Index = lazy(() => import("./pages/Index"));

const queryClient = new QueryClient();

// Code analysis now opens inside the profile page; keep old /import?repo=owner/repo links working.
function ImportRedirect() {
  const [params] = useSearchParams();
  const repo = params.get("repo");
  return <Navigate to={repo ? `/?analyze=${encodeURIComponent(repo)}` : "/"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
      <BrowserRouter>
        <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading...</p>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/import" element={<ImportRedirect />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
