import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Overview } from '@/pages/Overview';
import { Console } from '@/pages/Console';
import { Keys } from '@/pages/Keys';
import { KeyDetail } from '@/pages/KeyDetail';
import { History } from '@/pages/History';
import { Stats } from '@/pages/Stats';
import { Docs } from '@/pages/Docs';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/console" element={<Console />} />
          <Route path="/keys" element={<Keys />} />
          <Route path="/keys/:key" element={<KeyDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/docs" element={<Docs />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
