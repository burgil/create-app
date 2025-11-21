import { Outlet } from 'react-router';
import { type FC, Suspense } from 'react';
import SEOTitle from './components/SEOTitle';
import LoadingScreen from './components/LoadingScreen';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

const Layout: FC = () => {

  return (
    <Suspense fallback={<LoadingScreen />}>
      <SEOTitle />
      <Navbar />
      <Outlet />
      <Footer />
    </Suspense>
  );
};

export default Layout;
