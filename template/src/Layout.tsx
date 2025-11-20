import { Outlet } from 'react-router';
import { type FC, Suspense } from 'react';
import SEOTitle from './components/SEOTitle';
import LoadingScreen from './components/LoadingScreen';

const Layout: FC = () => {

  return (
    <Suspense fallback={<LoadingScreen />}>
      <SEOTitle />
      <Outlet />
    </Suspense>
  );
};

export default Layout;
