import { Outlet } from 'react-router';
import { type FC, Suspense, lazy } from 'react';
import SEOTitle from './components/SEOTitle';
import LoadingScreen from './components/LoadingScreen';
const Navbar = lazy(() => import('@/components/Navbar'));
import Footer from './components/Footer';

const Layout: FC = () => {
  // Check if we're in SSR mode (global flag set by prerenderer)
  const isSSR = typeof window !== 'undefined' && (window as unknown as { __SSR__?: boolean }).__SSR__;

  const content = (
    <>
      <SEOTitle />
      <main data-beasties-container className="min-h-screen bg-black selection:bg-blue-500/30 selection:text-blue-200 font-sans text-white">
        <Suspense fallback={<div className="h-16" />}>
          <Navbar />
        </Suspense>
        <Outlet />
        <Footer />
      </main>
    </>
  );

  // Skip Suspense during SSR to avoid renderToString errors
  if (isSSR) {
    return content;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      {content}
    </Suspense>
  );
};

export default Layout;
