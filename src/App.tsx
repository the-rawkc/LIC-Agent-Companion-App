import { BrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppRouter } from '@/app/router';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppLayout>
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </AppLayout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
