import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CrmProvider } from "@/store/CrmContext";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Today from "./pages/Today";
import Pipeline from "./pages/Pipeline";
import Campaigns from "./pages/Campaigns";
// Templates removed — drip generation is now inline in Account Drawer
import LeadDashboard from "./pages/LeadDashboard";
import LeadQueue from "./pages/LeadQueue";
import COIQueue from "./pages/COIQueue";
import Enrichment from "./pages/Enrichment";
import LeadSettings from "./pages/LeadSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CrmProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/today" element={<Today />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/campaigns" element={<Campaigns />} />
            {/* Templates route removed — drip inline */}
            <Route path="/leads" element={<LeadDashboard />} />
            <Route path="/lead-queue" element={<LeadQueue />} />
            <Route path="/coi-queue" element={<COIQueue />} />
            <Route path="/enrichment" element={<Enrichment />} />
            <Route path="/lead-settings" element={<LeadSettings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CrmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
