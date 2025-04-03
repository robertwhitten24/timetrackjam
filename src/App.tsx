import React, { useState, useEffect } from 'react';
import { Users, FolderKanban, List, PieChart, LogOut, ChevronDown, User, Bell, BarChart3, FileText, CreditCard, Settings } from 'lucide-react';
import { supabase } from './lib/supabase';
import Timer from './components/Timer';
import Clients from './components/Clients';
import Projects from './components/Projects';
import TimeEntries from './components/TimeEntries';
import Reports from './components/Reports';
import ScheduledReports from './components/ScheduledReports';
import UserReview from './components/UserReview';
import TeamManagement from './components/TeamManagement';
import Auth from './components/Auth';
import { AVAILABLE_PERMISSIONS } from './lib/types';

type TabId = 'timer' | 'clients' | 'projects' | 'entries' | 'reports' | 'scheduled-reports' | 'team-review' | 'team-management';

function App() {
  const [session, setSession] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabId>('timer');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'standard'>('standard');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);
  const [menuCollapsed, setMenuCollapsed] = useState(false);

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserRole('standard');
        setUserPermissions([]);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(!!session);
    if (session) {
      await fetchUserProfile(session.user.id);
    } else {
      setLoading(false);
    }
  }

  async function fetchUserProfile(userId: string) {
    try {
      setLoading(true);
      
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('role, permissions, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        return;
      }

      if (profile) {
        setUserRole(profile.role || 'standard');
        setUserPermissions(profile.permissions || []);
        setUserProfile(profile);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      setUserRole('standard');
      setUserPermissions(['timer']);
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setShowProfileDropdown(false);
  }

  function hasPermission(screen: string): boolean {
    if (userRole === 'admin') return true;
    return userPermissions.includes(screen);
  }

  const menuItems = [
    { id: 'timer', label: 'Timer', icon: List, section: 'TRACK' },
    { id: 'entries', label: 'Time Entries', icon: FileText, section: 'TRACK' },
    { id: 'reports', label: 'Reports', icon: BarChart3, section: 'ANALYZE' },
    { id: 'scheduled-reports', label: 'Scheduled Reports', icon: Bell, section: 'ANALYZE' },
    { id: 'clients', label: 'Clients', icon: Users, section: 'MANAGE' },
    { id: 'projects', label: 'Projects', icon: FolderKanban, section: 'MANAGE' },
  ];

  const teamItems = [
    { id: 'team-review', label: 'Team Review', icon: Users },
    { id: 'team-management', label: 'Team Management', icon: Settings },
  ];

  if (!session) {
    return <Auth onAuthSuccess={() => setSession(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <div className={`bg-[#902c3c] text-white flex flex-col transition-all duration-200 ${menuCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <img 
            src="https://i.ibb.co/4gsCmjss/628b1b-8e3e5b7b9df548d9bcdb39220105c4cf-mv2.png"
            alt="JAM Virtual Support"
            className={`${menuCollapsed ? 'w-8 h-8' : 'w-10 h-10'} transition-all duration-200`}
          />
          {!menuCollapsed && (
            <button 
              onClick={() => setMenuCollapsed(true)}
              className="text-white/50 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5 transform -rotate-90" />
            </button>
          )}
        </div>

        {/* Menu Sections */}
        <div className="flex-1 overflow-y-auto py-4 dark-scrollbar">
          {['TRACK', 'ANALYZE', 'MANAGE'].map(section => {
            const sectionItems = menuItems.filter(item => item.section === section);
            if (sectionItems.length === 0) return null;

            return (
              <div key={section} className="mb-6">
                {!menuCollapsed && (
                  <h3 className="px-4 mb-2 text-xs font-semibold text-white/50">
                    {section}
                  </h3>
                )}
                {sectionItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as TabId)}
                    className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${
                      activeTab === item.id
                        ? 'text-white bg-white/20'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${menuCollapsed ? 'mx-auto' : 'mr-3'}`} />
                    {!menuCollapsed && item.label}
                  </button>
                ))}
              </div>
            );
          })}

          {/* Team Section */}
          {teamItems.some(item => 
            item.id === 'team-management' ? userRole === 'admin' : hasPermission(item.id)
          ) && (
            <div className="mb-6">
              {!menuCollapsed && (
                <h3 className="px-4 mb-2 text-xs font-semibold text-white/50">
                  TEAM
                </h3>
              )}
              {teamItems.map(item => {
                if (item.id === 'team-management' && userRole !== 'admin') return null;
                if (!hasPermission(item.id)) return null;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as TabId)}
                    className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${
                      activeTab === item.id
                        ? 'text-white bg-white/20'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${menuCollapsed ? 'mx-auto' : 'mr-3'}`} />
                    {!menuCollapsed && item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Collapse Button */}
        {menuCollapsed && (
          <button 
            onClick={() => setMenuCollapsed(false)}
            className="p-4 text-white/50 hover:text-white transition-colors border-t border-white/10"
          >
            <ChevronDown className="w-5 h-5 transform rotate-90" />
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 h-16 flex-shrink-0">
          <div className="h-full px-4 flex items-center justify-end">
            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-center">
                  <User className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700">
                    {userProfile?.full_name || 'User'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showProfileDropdown ? 'transform rotate-180' : ''}`} />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'timer' && hasPermission('timer') && <Timer />}
          {activeTab === 'clients' && hasPermission('clients') && <Clients />}
          {activeTab === 'projects' && hasPermission('projects') && <Projects />}
          {activeTab === 'entries' && hasPermission('entries') && <TimeEntries />}
          {activeTab === 'reports' && hasPermission('reports') && <Reports />}
          {activeTab === 'scheduled-reports' && hasPermission('reports') && <ScheduledReports />}
          {activeTab === 'team-review' && hasPermission('team-review') && <UserReview />}
          {activeTab === 'team-management' && userRole === 'admin' && <TeamManagement />}
        </main>
      </div>
    </div>
  );
}

export default App;