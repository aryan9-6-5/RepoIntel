import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import NotFound from "./pages/NotFound";

import { Navbar } from "@/components/Navbar";

// Route-level code splitting: the profile explorer and RepoPilot load only when visited.
const Index = lazy(() => import("./pages/Index"));
const RepoImport = lazy(() => import("./pages/RepoImport"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navbar />
        <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading...</p>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/import" element={<RepoImport />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
