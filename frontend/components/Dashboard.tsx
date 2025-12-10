import React, { useState, useRef, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, XCircle, AlertCircle, Play, FolderOpen, Box, GitBranch, ArrowRight, ChevronDown, Filter, ExternalLink, Plus, LayoutGrid, List } from 'lucide-react';
import { MOCK_PROJECTS, DAILY_STATS } from '../constants';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState(MOCK_PROJECTS[0].id);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  const selectedProject = MOCK_PROJECTS.find(p => p.id === selectedProjectId) || MOCK_PROJECTS[0];
  const [selectedVersionId, setSelectedVersionId] = useState(selectedProject.versions[0].id);
  const [showFilter, setShowFilter] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sync version if project changes
  useEffect(() => {
    // If the currently selected version doesn't exist in the new project, switch to the first one
    const versionExists = selectedProject.versions.find(v => v.id === selectedVersionId);
    if (!versionExists && selectedProject.versions.length > 0) {
        setSelectedVersionId(selectedProject.versions[0].id);
    }
  }, [selectedProjectId, selectedProject, selectedVersionId]);

  const currentVersion = selectedProject.versions.find(v => v.id === selectedVersionId) || selectedProject.versions[0];

  const handleAddModule = () => {
      // Mock interaction
      alert("Opening 'Create Module' wizard...");
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      
      {/* Project & Version Controls Header */}
      <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-30 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Project Selector */}
            <div className="flex items-center gap-4" ref={projectDropdownRef}>
                <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Project</label>
                    <button 
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                        className="flex items-center gap-3 text-xl font-bold text-slate-800 hover:text-blue-600 transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                             <Box size={18} />
                        </div>
                        {selectedProject.name}
                        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Enhanced Dropdown */}
                    {isProjectDropdownOpen && (
                        <div className="absolute top-full left-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Select Project</div>
                            <div className="space-y-1">
                                {MOCK_PROJECTS.map(proj => (
                                    <button 
                                        key={proj.id}
                                        onClick={() => {
                                            setSelectedProjectId(proj.id);
                                            setIsProjectDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-4 transition-colors ${selectedProjectId === proj.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'}`}
                                    >
                                        <div className={`p-2 rounded-lg shrink-0 ${selectedProjectId === proj.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Box size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-bold truncate ${selectedProjectId === proj.id ? 'text-blue-700' : 'text-slate-700'}`}>{proj.name}</div>
                                            <div className="text-xs text-slate-500 mt-0.5 truncate">{proj.versions.length} versions • Last active today</div>
                                        </div>
                                        {selectedProjectId === proj.id && <CheckCircle2 size={18} className="text-blue-600"/>}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-100 px-2">
                                <button className="w-full py-2 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded flex items-center justify-center gap-2 transition-colors">
                                    <Plus size={14} /> Create New Project
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block"></div>
                
                {/* Version Selector */}
                <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Version</label>
                     <div className="flex bg-slate-100 p-1 rounded-lg">
                        {selectedProject.versions.map(ver => (
                            <button 
                                key={ver.id}
                                onClick={() => setSelectedVersionId(ver.id)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                    selectedVersionId === ver.id 
                                    ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200' 
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}
                            >
                                <GitBranch size={14} className={selectedVersionId === ver.id ? 'text-blue-500' : 'opacity-50'} />
                                {ver.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-4">
                <div className="text-right hidden lg:block">
                    <div className="text-xs font-bold text-slate-500 uppercase">Total Scripts</div>
                    <div className="text-xl font-black text-slate-800 leading-none">{currentVersion.stats.totalScripts}</div>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden lg:block"></div>
                <button 
                    onClick={() => navigate('/editor')}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 active:scale-95 flex items-center gap-2"
                >
                    <Plus size={18} />
                    New Test Case
                </button>
            </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* KPI Cards for Selected Version */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Pass Rate Card - Clickable */}
            <div 
                onClick={() => navigate('/results')}
                className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group relative overflow-hidden"
            >
                <div className="flex justify-between items-start z-10">
                    <p className="text-sm text-slate-500 font-medium mb-2">Pass Rate</p>
                    <ArrowRight size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </div>
                <div className="flex items-end justify-between z-10">
                    <span className="text-3xl font-bold text-slate-800">{currentVersion.stats.passRate}%</span>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${currentVersion.stats.passRate > 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {currentVersion.stats.passRate > 90 ? 'Excellent' : 'Needs Work'}
                    </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden z-10">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${currentVersion.stats.passRate}%` }}></div>
                </div>
                {/* Subtle background decoration */}
                <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
                    <CheckCircle2 size={80} className="translate-x-4 translate-y-4" />
                </div>
            </div>

            {/* Coverage Card - Clickable */}
            <div 
                onClick={() => navigate('/results')}
                className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group relative overflow-hidden"
            >
                <div className="flex justify-between items-start z-10">
                    <p className="text-sm text-slate-500 font-medium mb-2">Test Coverage</p>
                    <ArrowRight size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </div>
                <div className="flex items-end justify-between z-10">
                    <span className="text-3xl font-bold text-slate-800">{currentVersion.stats.coverage}%</span>
                    <GitBranch size={20} className="text-blue-500 mb-1" />
                </div>
                 <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden z-10">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${currentVersion.stats.coverage}%` }}></div>
                </div>
                {/* Subtle background decoration */}
                <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
                    <GitBranch size={80} className="translate-x-4 translate-y-4" />
                </div>
            </div>
             
             {/* Chart Mockup - Non-clickable (or links to analytics) */}
             <div className="md:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-start mb-2 z-10">
                    <div>
                         <p className="text-sm text-slate-500 font-medium">Trend (7 Days)</p>
                    </div>
                </div>
                <div className="absolute inset-0 top-8 opacity-50">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={DAILY_STATS}>
                           <defs>
                              <linearGradient id="miniChart" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <Area type="monotone" dataKey="pass" stroke="#3b82f6" strokeWidth={2} fill="url(#miniChart)" />
                        </AreaChart>
                     </ResponsiveContainer>
                </div>
             </div>
        </div>

        {/* Modules Grid */}
        <div>
            <div className="flex items-center justify-between mb-4 relative">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FolderOpen className="text-slate-400" size={20}/>
                    Modules & Functional Areas
                </h2>
                <div className="relative">
                    <button 
                        onClick={() => setShowFilter(!showFilter)}
                        className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors flex items-center gap-1 border
                            ${showFilter ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                        `}
                    >
                        <Filter size={14} /> Filter
                    </button>
                    {showFilter && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 p-2 animate-in fade-in zoom-in-95 duration-100">
                            <div className="text-xs font-bold text-slate-400 uppercase px-2 py-1">By Status</div>
                            <label className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                <input type="checkbox" className="rounded text-blue-600 mr-2" defaultChecked/>
                                <span className="text-sm text-slate-700">Active</span>
                            </label>
                            <label className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                <input type="checkbox" className="rounded text-blue-600 mr-2" />
                                <span className="text-sm text-slate-700">Inherited</span>
                            </label>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {currentVersion.modules.map(module => (
                    <div key={module.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                             <div>
                                <h3 className="font-bold text-slate-800 text-lg">{module.name}</h3>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{module.description || 'No description provided.'}</p>
                             </div>
                             {module.inheritedFrom && (
                                 <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded border border-slate-200 flex items-center gap-1">
                                    <GitBranch size={10} />
                                    Inherited from {module.inheritedFrom}
                                 </span>
                             )}
                        </div>
                        
                        <div className="flex-1 p-0">
                            {module.scripts.length > 0 ? (
                                <ul className="divide-y divide-slate-50">
                                    {module.scripts.slice(0, 3).map(script => (
                                        <li key={script.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate('/editor')}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    script.lastRunStatus === 'PASS' ? 'bg-emerald-500' : 
                                                    script.lastRunStatus === 'FAIL' ? 'bg-rose-500' : 'bg-slate-300'
                                                }`} />
                                                <span className="text-sm text-slate-700 font-medium">{script.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-xs text-slate-400">{script.lastRunStatus}</span>
                                                <ArrowRight size={14} className="text-slate-400" />
                                            </div>
                                        </li>
                                    ))}
                                    {module.scripts.length > 3 && (
                                        <li className="px-4 py-2 bg-slate-50 text-center">
                                            <span className="text-xs font-medium text-blue-600 hover:underline cursor-pointer">
                                                +{module.scripts.length - 3} more scripts
                                            </span>
                                        </li>
                                    )}
                                </ul>
                            ) : (
                                <div className="p-6 text-center text-slate-400 text-sm italic">
                                    No scripts linked to this module yet.
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex justify-end">
                             <button className="text-xs font-bold text-slate-600 hover:text-blue-600 uppercase tracking-wide">
                                Manage Module
                             </button>
                        </div>
                    </div>
                ))}
                
                {/* Add Module Placeholder */}
                <button 
                    onClick={handleAddModule}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all group min-h-[200px]"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                        <Plus size={20} className="ml-1" />
                    </div>
                    <span className="font-medium">Add Module</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;