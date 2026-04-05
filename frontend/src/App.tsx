import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { Layout, ToastProvider } from './components';
import { AuthProvider } from './context/AuthContext';
import { Home, ApiDemo, BlockchainDemo } from './pages';
import { ROUTES } from './routes/paths';
import { wagmiConfig } from './blockchain/wagmiConfig';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={polygon}>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <Routes>
                  <Route path={ROUTES.HOME} element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path={ROUTES.API_DEMO.slice(1)} element={<ApiDemo />} />
                    <Route path={ROUTES.BLOCKCHAIN_DEMO.slice(1)} element={<BlockchainDemo />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
