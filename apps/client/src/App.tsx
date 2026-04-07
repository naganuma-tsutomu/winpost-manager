import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { StallionsPage } from './features/horses/StallionsPage';
import { MaresPage } from './features/horses/MaresPage';
import { FoalsPage } from './features/foals/FoalsPage';
import { LineagesPage } from './features/horses/LineagesPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/stallions" element={<StallionsPage />} />
        <Route path="/mares" element={<MaresPage />} />
        <Route path="/foals" element={<FoalsPage />} />
        <Route path="/lineages" element={<LineagesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
