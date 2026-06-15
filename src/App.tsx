import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Home from '@/pages/Home';
import ActivityDetail from '@/pages/ActivityDetail';
import Publish from '@/pages/Publish';
import Checkin from '@/pages/Checkin';
import RiskPanel from '@/pages/RiskPanel';
import Dashboard from '@/pages/Dashboard';
import Review from '@/pages/Review';
import Profile from '@/pages/Profile';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-cream">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/checkin/:id" element={<Checkin />} />
          <Route path="/risk/:id" element={<RiskPanel />} />
          <Route path="/dashboard/:id" element={<Dashboard />} />
          <Route path="/review/:id" element={<Review />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </Router>
  );
}
