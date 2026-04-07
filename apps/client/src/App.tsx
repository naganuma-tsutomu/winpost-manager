import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { StallionsPage } from './features/horses/StallionsPage';
import { MaresPage } from './features/horses/MaresPage';
import { FoalsPage } from './features/foals/FoalsPage';
import { RacehorsesPage } from './features/racehorses/RacehorsesPage';
import { LineagesPage } from './features/horses/LineagesPage';
import { BreedingSimulatorPage } from './features/breeding/BreedingSimulatorPage';
import { PedigreeEditorPage } from './features/breeding/PedigreeEditorPage';
import { BreedingPlanPage } from './features/breeding/BreedingPlanPage';
import { OcrPage } from './features/ocr/OcrPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { GalleryPage } from './features/gallery/GalleryPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        {/* データ管理 */}
        <Route path="/racehorses" element={<RacehorsesPage />} />
        <Route path="/stallions" element={<StallionsPage />} />
        <Route path="/mares" element={<MaresPage />} />
        <Route path="/foals" element={<FoalsPage />} />
        <Route path="/lineages" element={<LineagesPage />} />
        {/* 配合シミュレーター */}
        <Route path="/breeding/simulator" element={<BreedingSimulatorPage />} />
        <Route path="/breeding/pedigree" element={<PedigreeEditorPage />} />
        <Route path="/breeding/plans" element={<BreedingPlanPage />} />
        {/* OCR 自動入力 */}
        <Route path="/ocr" element={<OcrPage />} />
        {/* メモ機能 */}
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
