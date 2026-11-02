/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HeaderTelemetry } from './components/HeaderTelemetry';
import { NavigationDock } from './components/NavigationDock';
import { HardLockUpdateScreen } from './components/HardLockUpdateScreen';
import { AuthView } from './views/AuthView';
import { OnboardingView } from './views/OnboardingView';
import { HomeView } from './views/HomeView';
import { LearnView } from './views/LearnView';
import { VivaView } from './views/VivaView';
import { HubView } from './views/HubView';
import { FriendsView } from './views/FriendsView';
import { BazaarView } from './views/BazaarView';
import { ProfileView } from './views/ProfileView';

const PRIVATE_ROUTES = new Set([
 '/home',
 '/learn',
 '/viva',
 '/hub',
 '/friends',
 '/bazaar',
 '/profile',
]);

const MainAppContent: React.FC = () => {
 const {
 currentRoute,
 isUpdateRequired,
 theme,
 authLoading,
 session,
 user,
 navigate,
 } = useApp();

 useEffect(() => {
 if (authLoading) return;

 if (!session) {
 if (currentRoute !== '/auth') navigate('/auth');
 return;
 }

 if (!user.onboardingComplete) {
 if (currentRoute !== '/onboarding') navigate('/onboarding');
 return;
 }

 if (currentRoute === '/auth' || currentRoute === '/onboarding') {
 navigate('/home');
 }
 }, [
 authLoading,
 currentRoute,
 navigate,
 session,
 user.onboardingComplete,
 ]);

 if (isUpdateRequired) {
 return <HardLockUpdateScreen />;
 }

 if (authLoading) {
 return (
 <div
 className="min-h-screen w-full bg-[#FAF8F5] text-slate-900"
 role="status"
 aria-live="polite"
 >
 <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
 Checking your session…
 </div>
 </div>
 );
 }

 // Never render a protected screen during a route transition.
 if (!session) {
 if (currentRoute !== '/auth') return null;
 } else if (!user.onboardingComplete) {
 if (currentRoute !== '/onboarding') return null;
 } else if (
 !PRIVATE_ROUTES.has(currentRoute) &&
 currentRoute !== '/auth' &&
 currentRoute !== '/onboarding'
 ) {
 return null;
 }

 const themeClass = (() => {
 switch (theme) {
 case 'charcoal':
 return 'dark bg-[#141416] text-white';
 case 'oled':
 return 'dark bg-[#000000] text-cyan-200';
 case 'jjk':
 return 'dark bg-[#120824] text-purple-200';
 case 'hinokami':
 return 'dark bg-[#1c0808] text-amber-200';
 case 'pastel':
 default:
 return 'bg-[#FAF8F5] text-slate-900';
 }
 })();

 const showHeader =
 currentRoute !== '/learn' &&
 currentRoute !== '/viva' &&
 currentRoute !== '/auth' &&
 currentRoute !== '/onboarding';

 return (
 <div className={`min-h-screen w-full transition-colors duration-300 md:pl-20 ${themeClass}`}>
 {showHeader && <HeaderTelemetry />}

 <main className="w-full">
 {!session && currentRoute === '/auth' && <AuthView />}

 {session &&
 !user.onboardingComplete &&
 currentRoute === '/onboarding' && <OnboardingView />}

 {session && user.onboardingComplete && currentRoute === '/home' && <HomeView />}
 {session && user.onboardingComplete && currentRoute === '/learn' && <LearnView />}
 {session && user.onboardingComplete && currentRoute === '/viva' && <VivaView />}
 {session && user.onboardingComplete && currentRoute === '/hub' && <HubView />}
 {session && user.onboardingComplete && currentRoute === '/friends' && <FriendsView />}
 {session && user.onboardingComplete && currentRoute === '/bazaar' && <BazaarView />}
 {session && user.onboardingComplete && currentRoute === '/profile' && <ProfileView />}
 </main>

 {session && user.onboardingComplete && <NavigationDock />}
 </div>
 );
};

export default function App() {
 return (
 <AppProvider>
 <MainAppContent />
 </AppProvider>
 );
}
