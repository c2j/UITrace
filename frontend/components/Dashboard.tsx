import React, { useState, useRef, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, XCircle, AlertCircle, Play, FolderOpen, Box, GitBranch, ArrowRight, ChevronDown, Filter, ExternalLink, Plus, LayoutGrid, List, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectVersion, ProjectStats } from '../types';
import { projectService } from '../services';
import { useApi, useMutation } from '../hooks/useApi';
import { ENABLE_MOCK_DATA } from '../services/api';
import { MOCK_PROJECTS, DAILY_STATS } from '../constants';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch projects with stats
  const { data: projects = [], loading: projectsLoading, error: projectsError, refetch: refetchProjects } = useApi(
    async () => {
      if (ENABLE_MOCK_DATA) {
        return { success: true, data: MOCK_PROJECTS };
      }
      return projectService.getProjects();
    },
    { immediate: true }
  );

  // Set initial project when data loads
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
      const firstVersion = projects[0].versions?.[0];
      setSelectedVersionId(firstVersion?.id || '');
    }
  }, [projects]); // Remove selectedProjectId from dependencies

  // Find selected project and version (with null checks)
  const selectedProject = projects && projects.length > 0
    ? (projects.find(p => p.id === selectedProjectId) || projects[0])
    : null;
  const currentVersion = selectedProject?.versions && selectedProject.versions.length > 0
    ? (selectedProject.versions.find(v => v.id === selectedVersionId) || selectedProject.versions[0])
    : null;

  // Create project mutation
  const createProjectMutation = useMutation(
    async (data: { name: string; icon?: string }) => {
      return projectService.createProject(data);
    },
    {
      onSuccess: () => {
        refetchProjects();
        setIsProjectDropdownOpen(false);
      },
    }
  );

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
    if (selectedProject && selectedProject.versions?.length > 0) {
      const versionExists = selectedProject.versions.find(v => v.id === selectedVersionId);
      if (!versionExists) {
        setSelectedVersionId(selectedProject.versions[0].id);
      }
    }
  }, [selectedProjectId, selectedProject]); // Remove selectedVersionId from dependencies

  const handleAddModule = () => {
    navigate('/editor', { state: { projectId: selectedProjectId, versionId: selectedVersionId } });
  };

  const handleCreateProject = () => {
    const name = prompt('Enter project name:');
    if (name) {
      createProjectMutation.mutate({ name });
    }
  };

  const renderLoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );

  const renderError = (message: string) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-red-700">
        <AlertCircle size={20} />
        <span>{message}</span>
      </div>
      <button
        onClick={refetchProjects}
        className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
      >
        Retry
      </button>
    </div>
  );

  if (projectsLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
        {renderLoadingSpinner()}
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-6">
        {renderError(projectsError)}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Box size={64} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Projects Yet</h3>
            <p className="text-slate-600 mb-6">Create your first project to get started with test automation.</p>
            <button
              onClick={handleCreateProject}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    );
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
                        {selectedProject?.name || 'Select Project'}
                        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Enhanced Dropdown */}
                    {isProjectDropdownOpen && (
                        <div className="absolute top-full left-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Select Project</div>
                            <div className="space-y-1">
                                {projects && projects.map(proj => (
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
                                            <div className="text-xs text-slate-500 mt-0.5 truncate">{proj.versions?.length || 0} versions • Last active today</div>
                                        </div>
                                        {selectedProjectId === proj.id && <CheckCircle2 size={18} className="text-blue-600"/>}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-100 px-2">
                                <button
                                  onClick={handleCreateProject}
                                  disabled={createProjectMutation.loading}
                                  className="w-full py-2 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {createProjectMutation.loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Create New Project
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
                        {selectedProject?.versions?.map(ver => (
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
                    <div className="text-xl font-black text-slate-800 leading-none">{currentVersion?.stats?.totalScripts || 0}</div>
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
                className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                onClick={() => navigate('/results')}
            >
                <div className="flex items-center justify-between mb-3">
                    <CheckCircle2 className="text-green-600" size={24} />
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">+5%</span>
                </div>
                <div className="text-3xl font-black text-slate-800 leading-none">{currentVersion?.stats?.passRate || 0}%</div>
                <div className="text-sm font-medium text-green-700 mt-1">Pass Rate</div>
            </div>

            {/* Failures Card - Clickable */}
            <div
                className="bg-gradient-to-br from-red-50 to-pink-100 border border-red-200 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                onClick={() => navigate('/results')}
            >
                <div className="flex items-center justify-between mb-3">
                    <XCircle className="text-red-600" size={24} />
                    <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">-2</span>
                </div>
                <div className="text-3xl font-black text-slate-800 leading-none">{currentVersion?.stats?.totalScripts ? Math.round((currentVersion.stats.totalScripts * (100 - (currentVersion.stats.passRate || 0))) / 100) : 0}</div>
                <div className="text-sm font-medium text-red-700 mt-1">Failures</div>
            </div>

            {/* Coverage Card - Clickable */}
            <div
                className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                onClick={() => navigate('/editor')}
            >
                <div className="flex items-center justify-between mb-3">
                    <AlertCircle className="text-blue-600" size={24} />
                    <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">+12%</span>
                </div>
                <div className="text-3xl font-black text-slate-800 leading-none">{currentVersion?.stats?.coverage || 0}%</div>
                <div className="text-sm font-medium text-blue-700 mt-1">Coverage</div>
            </div>

            {/* Total Scripts Card - Clickable */}
            <div
                className="bg-gradient-to-br from-purple-50 to-indigo-100 border border-purple-200 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                onClick={() => navigate('/editor')}
            >
                <div className="flex items-center justify-between mb-3">
                    <FolderOpen className="text-purple-600" size={24} />
                    <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-full">+8</span>
                </div>
                <div className="text-3xl font-black text-slate-800 leading-none">{currentVersion?.stats?.totalScripts || 0}</div>
                <div className="text-sm font-medium text-purple-700 mt-1">Total Scripts</div>
            </div>

        </div>

        {/* Daily Execution Trend Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800">Execution Trend</h3>
                <button className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
                    Last 7 Days
                </button>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                    <AreaChart data={DAILY_STATS}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="date"
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="pass"
                            stackId="1"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.8}
                        />
                        <Area
                            type="monotone"
                            dataKey="fail"
                            stackId="1"
                            stroke="#ef4444"
                            fill="#ef4444"
                            fillOpacity={0.8}
                        />
                        <Area
                            type="monotone"
                            dataKey="skip"
                            stackId="1"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.8}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Modules Grid */}
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Modules</h3>
                <div className="flex items-center gap-2">
                    <button className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
                        <Filter size={14} />
                        Filter
                    </button>
                    <button
                        onClick={handleAddModule}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Add Module
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentVersion?.modules?.map(module => (
                    <div key={module.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-all hover:border-blue-300 cursor-pointer group"
                         onClick={() => navigate('/editor', { state: { moduleId: module.id } })}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Box size={20} />
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink size={16} className="text-slate-400" />
                            </button>
                        </div>
                        <h4 className="font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">{module.name}</h4>
                        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{module.description || 'No description'}</p>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">{module.scripts?.length || 0} scripts</span>
                            <span className="text-slate-400">→</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;