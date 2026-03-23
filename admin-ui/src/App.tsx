import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Toaster } from '@/components/ui/toaster';
import DashboardPage from '@/pages/Dashboard';
import ProvidersPage from '@/pages/Providers';
import ModelsPage from '@/pages/Models';
import LogsPage from '@/pages/Logs';
import StreamPage from '@/pages/Stream';
import ApiKeysPage from '@/pages/ApiKeys';
import OrgsPage from '@/pages/Orgs';
import TeamsPage from '@/pages/Teams';
import UsersPage from '@/pages/Users';

function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/keys" element={<ApiKeysPage />} />
          <Route path="/orgs" element={<OrgsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/stream" element={<StreamPage />} />
        </Routes>
      </Layout>
      <Toaster />
    </>
  );
}

export default App;
