import { Routes, Route } from 'react-router-dom';
import Catalog from './pages/Catalog';
import Admin from './pages/Admin';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Catalog />} />
      <Route path="/admin/*" element={<Admin />} />
    </Routes>
  );
}

export default App;
