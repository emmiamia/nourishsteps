import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Suspense, lazy } from 'react';
import { SkeletonCard } from './components/Skeleton';
import ThemeToggle from './components/ThemeToggle';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const CheckIn = lazy(() => import('./pages/CheckIn'));
const Toolbox = lazy(() => import('./pages/Toolbox'));
const Resources = lazy(() => import('./pages/Resources'));
const Progress = lazy(() => import('./pages/Progress'));
const Meals = lazy(() => import('./pages/Meals'));

export default function App(){
  return (
    <BrowserRouter>
      <div className="min-h-screen text-base-content bg-noise">
        <div className="navbar bg-base-200/70 backdrop-blur sticky top-0 z-10 shadow-sm">
          <div className="flex-1">
            <Link className="btn btn-ghost text-xl" to="/">NourishSteps</Link>
          </div>
          <div className="flex-none gap-2">
            <Link className="btn btn-ghost" to="/checkin">Check-In</Link>
            <Link className="btn btn-ghost" to="/toolbox">Toolbox</Link>
            <Link className="btn btn-ghost" to="/meals">Meal</Link>
            <Link className="btn btn-ghost" to="/resources">Resources</Link>
            <Link className="btn btn-primary" to="/progress">Progress</Link>
            <ThemeToggle />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mx-auto p-4 max-w-6xl"
        >
          <div className="rounded-2xl bg-base-100/70 backdrop-blur shadow-lg p-4 md:p-6">
            <Suspense fallback={<div className="grid gap-4"><SkeletonCard /><SkeletonCard /></div>}>
              <Routes>
                <Route path="/" element={<Home/>} />
                <Route path="/checkin" element={<CheckIn/>} />
                <Route path="/toolbox" element={<Toolbox/>} />
                <Route path="/resources" element={<Resources/>} />
                <Route path="/progress" element={<Progress/>} />
                <Route path="/meals" element={<Meals />} />
              </Routes>
            </Suspense>
            <p className="mt-8 text-xs opacity-70">
              This app is for educational purposes only and is not medical advice.
            </p>
          </div>
        </motion.div>
      </div>
    </BrowserRouter>
  );
}
