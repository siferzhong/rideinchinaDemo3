
import React, { useState, useEffect } from 'react';
import { AppTab } from './types';
import Home from './pages/Home';
import Routes from './pages/Routes';
import RideMap from './pages/RideMap';
import Documents from './pages/Documents';
import Me from './pages/Me';
import PhotoLive from './pages/PhotoLive';
import Admin from './pages/Admin';
import InstallPrompt from './components/InstallPrompt';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getUserPermissions } from './services/permissions';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.HOME);
  const { isAuthenticated } = useAuth();
  const [showAdminTab, setShowAdminTab] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      if (isAuthenticated) {
        try {
          const perms = await getUserPermissions();
          setShowAdminTab(perms.role === 'admin' || perms.role === 'leader');
        } catch (error) {
          console.error('Failed to check permissions:', error);
        }
      }
    };
    checkPermissions();
  }, [isAuthenticated]);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.HOME: return <Home onNavigate={setActiveTab} />;
      case AppTab.ROUTES: return <Routes />;
      case AppTab.MAP: return <RideMap />;
      case AppTab.DOCS: return <Documents />;
      case AppTab.AI: return <Me />;
      case AppTab.GALLERY: return <PhotoLive />;
      case AppTab.ADMIN: return <Admin />;
      default: return <Home onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white shadow-2xl overflow-hidden relative">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-1.5 rounded-lg">
            <i className="fa-solid fa-motorcycle text-white text-lg"></i>
          </div>
          <span className="font-bold text-lg tracking-tight">RIDE IN CHINA</span>
        </div>
        <button className="text-slate-400">
          <i className="fa-solid fa-bell"></i>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 hide-scrollbar pb-20">
        {renderContent()}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 flex justify-around py-3 px-2 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <NavButton 
          active={activeTab === AppTab.HOME} 
          icon="fa-house" 
          label="Home" 
          onClick={() => setActiveTab(AppTab.HOME)} 
        />
        <NavButton 
          active={activeTab === AppTab.ROUTES} 
          icon="fa-route" 
          label="Routes" 
          onClick={() => setActiveTab(AppTab.ROUTES)} 
        />
        <NavButton 
          active={activeTab === AppTab.MAP} 
          icon="fa-map-location-dot" 
          label="Ride" 
          onClick={() => setActiveTab(AppTab.MAP)} 
        />
        <NavButton 
          active={activeTab === AppTab.GALLERY} 
          icon="fa-images" 
          label="Photos" 
          onClick={() => setActiveTab(AppTab.GALLERY)} 
        />
        {showAdminTab ? (
          <NavButton 
            active={activeTab === AppTab.ADMIN} 
            icon="fa-shield-halved" 
            label="Admin" 
            onClick={() => setActiveTab(AppTab.ADMIN)} 
          />
        ) : (
          <NavButton 
            active={activeTab === AppTab.AI} 
            icon="fa-user" 
            label="Me" 
            onClick={() => setActiveTab(AppTab.AI)} 
          />
        )}
      </nav>

      {/* PWA 安装提示 */}
      <InstallPrompt />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

interface NavButtonProps {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ active, icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 min-w-[55px] transition-colors ${active ? 'text-orange-600' : 'text-slate-400'}`}
  >
    <i className={`fa-solid ${icon} text-lg`}></i>
    <span className="text-[9px] font-medium uppercase tracking-wider">{label}</span>
  </button>
);

export default App;
