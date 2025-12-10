import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileCode, Server, Settings, User, Layers, LogOut } from 'lucide-react';

const SidebarItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    return (
        <NavLink 
            to={to} 
            className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1
                ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }
            `}
        >
            <Icon size={18} />
            <span>{label}</span>
        </NavLink>
    );
};

const Layout: React.FC = () => {
    const location = useLocation();

    // Mapping path to title
    const getPageTitle = () => {
        if (location.pathname === '/') return 'Dashboard';
        if (location.pathname === '/editor') return 'Script Editor';
        if (location.pathname === '/results') return 'Test Results';
        return 'UITrace';
    };

    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 flex flex-col border-r border-slate-800 bg-slate-900 shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-blue-500/20">
                        <span className="text-white font-bold text-lg">U</span>
                    </div>
                    <span className="text-white font-bold text-lg tracking-tight">UITrace</span>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="mb-6">
                        <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Platform</p>
                        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                        <SidebarItem to="/editor" icon={FileCode} label="Script Editor" />
                        <SidebarItem to="/results" icon={Layers} label="Executions" />
                    </div>
                    
                    <div>
                        <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System</p>
                        <SidebarItem to="/server" icon={Server} label="Server Nodes" />
                        <SidebarItem to="/settings" icon={Settings} label="Settings" />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                            QA
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">Jane Doe</p>
                            <p className="text-xs text-slate-400 truncate">Lead SDET</p>
                        </div>
                        <button className="text-slate-400 hover:text-white">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
                <div className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm shrink-0">
                    <h1 className="text-lg font-bold text-slate-800">{getPageTitle()}</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            Server Connected
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;