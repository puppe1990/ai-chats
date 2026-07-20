import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppReadyGate } from '../components/AppReadyGate'
import Footer from '../components/Footer'
import Header from '../components/Header'

export const Route = createRootRoute({
  component: () => (
    <>
      <AppReadyGate />
      <Header />
      <Outlet />
      <Footer />
    </>
  ),
})
