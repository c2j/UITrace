import React, { useState } from 'react';
import { ChevronLeft, Check, AlertTriangle, Download, Clock, Maximize2, Activity, Zap, CheckCircle2, FileText, Wifi, Monitor, AlertCircle, X, Play, Pause, SkipForward, MousePointer, Image as ImageIcon, Terminal, Globe, Loader2, FileDown, Search, Filter, Calendar, Box, GitBranch, ChevronRight, LayoutGrid } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { MOCK_LOGS, MOCK_VISUAL_DIFF } from '../constants';
import { useNavigate } from 'react-router-dom';

// Mock Data for the List View
const RECENT_EXECUTIONS = [
    { id: 'exec-1', project: 'E-Commerce Storefront', version: 'v2.1.0', testCase: 'TC002 - Login Failure', module: 'Authentication', status: 'FAIL', duration: '12.4s', environment: 'Chrome 114 (Win 11)', triggeredBy: 'Schedule', time: 'Just now' },
    { id: 'exec-2', project: 'E-Commerce Storefront', version: 'v2.1.0', testCase: 'TC001 - Login Success', module: 'Authentication', status: 'PASS', duration: '4.8s', environment: 'Chrome 114 (Win 11)', triggeredBy: 'CI/CD', time: '15 mins ago' },
    { id: 'exec-3', project: 'E-Commerce Storefront', version: 'v2.1.0', testCase: 'TC015 - Checkout Flow', module: 'Checkout', status: 'PASS', duration: '22.1s', environment: 'Firefox 112 (Linux)', triggeredBy: 'Manual', time: '1 hour ago' },
    { id: 'exec-4', project: 'Admin Dashboard Portal', version: 'v1.5.0', testCase: 'TC005 - Update Profile', module: 'User Settings', status: 'SKIP', duration: '0s', environment: 'Edge 112 (Win 10)', triggeredBy: 'Dependency', time: '3 hours ago' },
    { id: 'exec-5', project: 'E-Commerce Storefront', version: 'v2.0.0', testCase: 'TC021 - Search Items', module: 'Search', status: 'PASS', duration: '3.5s', environment: 'Safari 16 (macOS)', triggeredBy: 'Schedule', time: 'Yesterday' },
    { id: 'exec-6', project: 'E-Commerce Storefront', version: 'v2.1.0', testCase: 'TC001 - Login Success', module: 'Authentication', status: 'PASS', duration: '4.5s', environment: 'Chrome 114 (Win 11)', triggeredBy: 'Manual', time: 'Yesterday' },
];

const TestResult: React.FC = () => {
  const navigate = useNavigate();
  
  // View State: 'list' or 'detail'
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  
  // List View Filter State
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('All Projects');

  // Detail View States
  const [diffMode, setDiffMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [showTrace, setShowTrace] = useState(false);
  const [traceStep, setTraceStep] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingTrace, setIsDownloadingTrace] = useState(false);
  const [baselineAccepted, setBaselineAccepted] = useState(false);

  // Derived Data
  const uniqueProjects = Array.from(new Set(RECENT_EXECUTIONS.map(e => e.project)));
  const filteredExecutions = selectedProjectFilter === 'All Projects' 
      ? RECENT_EXECUTIONS 
      : RECENT_EXECUTIONS.filter(e => e.project === selectedProjectFilter);

  // Mock Report Data (Static for demo, but would dynamic based on ID)
  const REPORT_METRICS = {
    qualityScore: selectedExecutionId === 'exec-2' ? 98 : 78,
    grade: selectedExecutionId === 'exec-2' ? 'A' : 'C+',
    duration: '12.4s',
    totalSteps: 5,
    passedSteps: selectedExecutionId === 'exec-2' ? 5 : 4,
    failedSteps: selectedExecutionId === 'exec-2' ? 0 : 1,
    networkRequests: 45,
    dataTransferred: '2.1 MB',
    consoleErrors: selectedExecutionId === 'exec-2' ? 0 : 1
  };

  const WEB_VITALS = [
    { label: 'LCP', value: '1.2s', status: 'good', desc: 'Largest Contentful Paint' },
    { label: 'FID', value: '45ms', status: 'good', desc: 'First Input Delay' },
    { label: 'CLS', value: '0.15', status: 'warning', desc: 'Cumulative Layout Shift' },
  ];

  const STEP_DATA = [
    { name: 'Passed', value: REPORT_METRICS.passedSteps, color: '#10b981' },
    { name: 'Failed', value: REPORT_METRICS.failedSteps, color: '#f43f5e' },
  ];

  // Mock Trace Data
  const TRACE_STEPS = [
    { id: 1, time: '0s', action: 'page.goto', target: 'https://portal.uitrace.com', duration: '1.2s', status: 'pass' },
    { id: 2, time: '1.3s', action: 'click', target: 'button#login-btn', duration: '0.3s', status: 'pass' },
    { id: 3, time: '1.8s', action: 'fill', target: 'input[name="email"]', value: 'test@example.com', duration: '0.1s', status: 'pass' },
    { id: 4, time: '2.0s', action: 'fill', target: 'input[name="password"]', value: '********', duration: '0.1s', status: 'pass' },
    { id: 5, time: '2.5s', action: 'click', target: 'button#submit-login-v2', duration: '15s', status: 'fail' },
  ];

  const handleExportPdf = () => {
    setIsExporting(true);
    setTimeout(() => setIsExporting(false), 2000); 
  };

  const handleDownloadTrace = () => {
      setIsDownloadingTrace(true);
      setTimeout(() => setIsDownloadingTrace(false), 1500);
  };

  const handleAcceptBaseline = () => {
      setBaselineAccepted(true);
  }

  const handleViewDetail = (id: string) => {
      setSelectedExecutionId(id);
      setViewMode('detail');
  }

  const handleBackToList = () => {
      setViewMode('list');
      setSelectedExecutionId(null);
  }

  const selectedExecution = RECENT_EXECUTIONS.find(e => e.id === selectedExecutionId);

  // --- RENDER LIST VIEW ---
  if (viewMode === 'list') {
      return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Execution History</h1>
                        <div className="flex items-center gap-2 mt-1">
                             <p className="text-sm text-slate-500">Showing results for:</p>
                             <div className="relative group">
                                 <button className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                     {selectedProjectFilter} <ChevronRight size={14} className="rotate-90"/>
                                 </button>
                                 <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 p-1 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                                     <button 
                                        onClick={() => setSelectedProjectFilter('All Projects')}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 hover:bg-slate-50 ${selectedProjectFilter === 'All Projects' ? 'font-bold text-blue-600 bg-blue-50' : 'text-slate-700'}`}
                                     >
                                         <LayoutGrid size={14}/> All Projects
                                     </button>
                                     <div className="h-px bg-slate-100 my-1"></div>
                                     {uniqueProjects.map(p => (
                                         <button 
                                            key={p}
                                            onClick={() => setSelectedProjectFilter(p)}
                                            className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 hover:bg-slate-50 ${selectedProjectFilter === p ? 'font-bold text-blue-600 bg-blue-50' : 'text-slate-700'}`}
                                         >
                                             <Box size={14}/> {p}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search executions..." 
                            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                        <Filter size={16} /> Filter
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Project & Version</th>
                                <th className="px-6 py-4">Test Case</th>
                                <th className="px-6 py-4">Environment</th>
                                <th className="px-6 py-4">Trigger</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExecutions.length > 0 ? (
                                filteredExecutions.map((exec) => (
                                    <tr key={exec.id} onClick={() => handleViewDetail(exec.id)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border
                                                ${exec.status === 'PASS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                  exec.status === 'FAIL' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                                                  'bg-slate-100 text-slate-500 border-slate-200'}
                                            `}>
                                                {exec.status === 'PASS' ? <CheckCircle2 size={12} className="mr-1"/> : 
                                                 exec.status === 'FAIL' ? <AlertCircle size={12} className="mr-1"/> : null}
                                                {exec.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                <Box size={14} className="text-blue-500" /> {exec.project}
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 ml-5">
                                                <GitBranch size={12} className="text-slate-400" /> {exec.version}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700 text-sm">{exec.testCase}</div>
                                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                <Globe size={10} /> {exec.module}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Monitor size={14} className="text-slate-400"/>
                                                {exec.environment}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                {exec.triggeredBy}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-600">{exec.duration}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{exec.time}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">View Report &rarr;</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                                <Search size={20} className="text-slate-400"/>
                                            </div>
                                            <p className="font-medium">No executions found for this project.</p>
                                            <p className="text-sm mt-1">Try selecting "All Projects" or adjusting your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      );
  }

  // --- RENDER DETAIL VIEW ---
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button onClick={handleBackToList} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
             {/* Breadcrumb for Detail View */}
             {selectedExecution && (
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1"><Box size={10} /> {selectedExecution.project}</span>
                    <ChevronRight size={10} className="text-slate-300"/>
                    <span className="flex items-center gap-1"><GitBranch size={10} /> {selectedExecution.version}</span>
                    <ChevronRight size={10} className="text-slate-300"/>
                    <span className="text-blue-600">{selectedExecution.module}</span>
                 </div>
             )}

             <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-800">
                    {selectedExecution?.testCase || 'Execution Report'}
                </h1>
                <span className={`px-3 py-1 rounded-full font-bold text-xs border shadow-sm
                    ${REPORT_METRICS.failedSteps > 0 
                        ? 'bg-rose-100 text-rose-700 border-rose-200' 
                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'}
                `}>
                    {REPORT_METRICS.failedSteps > 0 ? 'FAILED' : 'PASSED'}
                </span>
             </div>
             <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium"><Clock size={12}/> {REPORT_METRICS.duration}</span>
                <span>•</span>
                <span>{selectedExecution?.environment || 'Chrome 114'}</span>
                <span>•</span>
                <span>{selectedExecution?.time || 'Just now'}</span>
             </div>
          </div>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={() => setShowTrace(true)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm active:scale-95"
            >
                View Trace
            </button>
            <button 
                onClick={handleExportPdf}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm shadow-blue-200 transition-all active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
            >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {isExporting ? 'Generating PDF...' : 'Export PDF'}
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Section 1: Executive Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Quality Score Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${REPORT_METRICS.failedSteps > 0 ? 'from-orange-400 to-rose-500' : 'from-emerald-400 to-cyan-500'}`}></div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Quality Score</h3>
                <div className="relative flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full border-8 border-slate-100 flex items-center justify-center">
                         <span className="text-3xl font-black text-slate-800">{REPORT_METRICS.qualityScore}</span>
                    </div>
                    <div className={`absolute -bottom-2 px-3 py-1 text-sm font-bold rounded-full border
                        ${REPORT_METRICS.grade.startsWith('A') ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}
                    `}>
                        Grade {REPORT_METRICS.grade}
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center px-4">
                    {REPORT_METRICS.failedSteps > 0 
                        ? <span>Score impacted by <span className="text-rose-500 font-medium">1 Failure</span>.</span>
                        : <span>Excellent performance with <span className="text-emerald-500 font-medium">zero errors</span>.</span>
                    }
                </p>
            </div>

            {/* Step Distribution */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Step Execution</h3>
                <div className="flex-1 flex items-center gap-4">
                    <div className="w-24 h-24 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={STEP_DATA} innerRadius={25} outerRadius={40} paddingAngle={5} dataKey="value">
                                    {STEP_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 flex-1">
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Passed</span>
                            <span className="font-bold text-slate-800">{REPORT_METRICS.passedSteps}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Failed</span>
                            <span className="font-bold text-slate-800">{REPORT_METRICS.failedSteps}</span>
                        </div>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>Completion</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Zap size={14} className="text-amber-500"/>
                    Performance & Vitals
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                    {WEB_VITALS.map((vital) => (
                        <div key={vital.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-bold text-slate-700">{vital.label}</span>
                                <div className={`w-2 h-2 rounded-full ${vital.status === 'good' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            </div>
                            <div className="text-xl font-black text-slate-800">{vital.value}</div>
                            <div className="text-[10px] text-slate-400 truncate" title={vital.desc}>{vital.desc}</div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2 text-slate-600 text-xs">
                            <Wifi size={14} />
                            <span>Requests: <strong>{REPORT_METRICS.networkRequests}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 text-xs">
                            <Activity size={14} />
                            <span>Data: <strong>{REPORT_METRICS.dataTransferred}</strong></span>
                        </div>
                    </div>
                    {REPORT_METRICS.consoleErrors > 0 && (
                        <div className="flex items-center gap-2 text-rose-600 text-xs font-medium bg-rose-50 px-2 py-1 rounded">
                            <AlertCircle size={12} />
                            {REPORT_METRICS.consoleErrors} Console Error
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Section 2: Detailed Analysis (Split View) */}
        <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
            
            {/* Logs Panel */}
            <div className="w-full lg:w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <FileText size={16} />
                        Execution Log
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-[10px] bg-white border px-1.5 py-0.5 rounded text-slate-500 font-mono">All Levels</span>
                    </div>
                </div>
                
                {/* Failure Context Box (Only if Failed) */}
                {REPORT_METRICS.failedSteps > 0 && (
                    <div className="bg-rose-50 p-4 border-b border-rose-100 shrink-0">
                        <div className="flex gap-3">
                            <AlertTriangle className="text-rose-600 shrink-0" size={18} />
                            <div>
                                <p className="text-xs font-bold text-rose-800 uppercase mb-1">Root Cause Analysis</p>
                                <p className="text-sm text-rose-700 leading-snug">
                                    Element <code className="bg-rose-100 px-1 rounded text-rose-900 text-xs">#submit-login-v2</code> became non-interactable due to a DOM overlay.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-200 font-mono text-xs p-4 space-y-1">
                    {MOCK_LOGS.map((log, i) => (
                        <div key={i} className={`flex gap-3 p-1 rounded hover:bg-slate-800 ${log.level === 'ERROR' ? 'bg-red-900/20' : ''}`}>
                            <span className="text-slate-500 shrink-0 select-none w-16">{log.timestamp}</span>
                            <span className={`font-bold shrink-0 w-10 ${
                                log.level === 'ERROR' ? 'text-rose-400' : 
                                log.level === 'DEBUG' ? 'text-blue-400' : 'text-emerald-400'
                            }`}>
                                {log.level}
                            </span>
                            <span className={`break-all ${log.level === 'ERROR' ? 'text-rose-200' : 'text-slate-300'}`}>
                                {log.message}
                            </span>
                        </div>
                    ))}
                    {REPORT_METRICS.failedSteps === 0 && (
                        <div className="text-emerald-400 mt-2">Test execution completed successfully.</div>
                    )}
                </div>
            </div>

            {/* Visual Regression Panel */}
            <div className="w-full lg:w-2/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Monitor size={16} />
                            Visual Regression
                        </h3>
                        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                            <button 
                                onClick={() => setDiffMode('side-by-side')}
                                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${diffMode === 'side-by-side' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Side-by-Side
                            </button>
                            <button 
                                onClick={() => setDiffMode('overlay')}
                                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${diffMode === 'overlay' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Overlay
                            </button>
                        </div>
                        {diffMode === 'overlay' && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Opacity</span>
                                <input 
                                    type="range" min="0" max="100" 
                                    value={overlayOpacity} 
                                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                                    className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end mr-2">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Diff Match</span>
                            <span className={`text-sm font-bold ${MOCK_VISUAL_DIFF.diffPercentage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {MOCK_VISUAL_DIFF.diffPercentage}% DZN
                            </span>
                        </div>
                        <button 
                            onClick={handleAcceptBaseline}
                            disabled={baselineAccepted}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm
                                ${baselineAccepted 
                                    ? 'bg-emerald-100 text-emerald-700 cursor-default' 
                                    : 'text-white bg-blue-600 hover:bg-blue-700'
                                }
                            `}
                        >
                            {baselineAccepted ? <CheckCircle2 size={14}/> : <Check size={14} />}
                            {baselineAccepted ? 'Baseline Accepted' : 'Accept Baseline'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-slate-100 overflow-auto p-6 flex items-center justify-center">
                    {diffMode === 'side-by-side' ? (
                        <div className="flex gap-4 w-full h-full">
                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Baseline (v1.0)</span>
                                </div>
                                <div className="flex-1 border-4 border-emerald-100 rounded-lg overflow-hidden shadow-sm bg-white relative group">
                                    <img src={MOCK_VISUAL_DIFF.baselineUrl} alt="Baseline" className="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 transition-all duration-500" />
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Current (Failed)</span>
                                </div>
                                <div className="flex-1 border-4 border-rose-100 rounded-lg overflow-hidden shadow-sm bg-white relative">
                                    <img src={MOCK_VISUAL_DIFF.actualUrl} alt="Actual" className="w-full h-full object-cover" />
                                    {/* Simulated Diff Highlight */}
                                    <div className="absolute top-1/4 left-1/4 w-1/3 h-1/3 border-2 border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse">
                                        <div className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                            Mismatch Detected
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative w-full h-full max-h-[500px] aspect-video border border-slate-300 rounded-lg shadow-lg overflow-hidden bg-white">
                            <img 
                                src={MOCK_VISUAL_DIFF.baselineUrl} 
                                alt="Baseline" 
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <img 
                                src={MOCK_VISUAL_DIFF.actualUrl} 
                                alt="Actual" 
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ opacity: overlayOpacity / 100 }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* TRACE VIEWER MODAL */}
      {showTrace && (
          <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full h-full max-w-7xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
                  
                  {/* Trace Header */}
                  <div className="bg-slate-900 text-white p-3 flex justify-between items-center border-b border-slate-700 shrink-0">
                      <div className="flex items-center gap-4">
                          <h2 className="text-sm font-bold flex items-center gap-2">
                             <Activity className="text-blue-500" size={16}/>
                             Trace Viewer
                          </h2>
                          <div className="h-4 w-px bg-slate-700"></div>
                          <span className="text-xs text-slate-400 font-mono">trace-20231025-tc002.zip</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <button 
                            onClick={handleDownloadTrace}
                            disabled={isDownloadingTrace}
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                            title="Download Trace Package"
                         >
                             {isDownloadingTrace ? <Loader2 size={16} className="animate-spin text-blue-400"/> : <Download size={16} />}
                         </button>
                         <button onClick={() => setShowTrace(false)} className="p-1.5 hover:bg-rose-900/50 rounded text-slate-400 hover:text-rose-400 transition-colors">
                             <X size={18} />
                         </button>
                      </div>
                  </div>

                  {/* Trace Timeline Scrubber */}
                  <div className="bg-slate-800 p-2 border-b border-slate-700 shrink-0">
                      <div className="h-12 bg-slate-900 rounded border border-slate-700 relative flex items-center px-2 cursor-pointer group">
                           {/* Timeline marks */}
                           {TRACE_STEPS.map((step, idx) => (
                               <div 
                                    key={step.id} 
                                    className="absolute h-6 w-1 rounded-full hover:h-8 hover:bg-blue-400 transition-all cursor-pointer"
                                    style={{ 
                                        left: `${(idx / (TRACE_STEPS.length - 1)) * 95 + 2}%`, 
                                        backgroundColor: idx === traceStep ? '#3b82f6' : step.status === 'fail' ? '#f43f5e' : '#64748b' 
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setTraceStep(idx); }}
                                    title={`Step ${idx + 1}: ${step.action}`}
                               ></div>
                           ))}
                           {/* Playhead */}
                           <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none transition-all duration-300" style={{ left: `${(traceStep / (TRACE_STEPS.length - 1)) * 95 + 2}%` }}>
                                <div className="w-3 h-3 bg-blue-500 rotate-45 -ml-[5px] -mt-1.5 rounded-sm"></div>
                           </div>
                      </div>
                  </div>

                  {/* Trace Content */}
                  <div className="flex-1 flex overflow-hidden bg-slate-100">
                      
                      {/* Left: Action List */}
                      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
                          <div className="p-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between">
                              <span>Actions</span>
                              <span>Duration</span>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                              {TRACE_STEPS.map((step, index) => (
                                  <div 
                                    key={step.id} 
                                    onClick={() => setTraceStep(index)}
                                    className={`px-3 py-2 border-b border-slate-100 flex items-center gap-3 cursor-pointer transition-colors
                                        ${index === traceStep ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}
                                    `}
                                  >
                                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px] font-bold uppercase
                                          ${step.status === 'fail' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}
                                      `}>
                                          {step.status === 'fail' ? 'ERR' : 'OK'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                              <span className="font-bold text-xs text-slate-700">{step.action}</span>
                                              <span className="text-[10px] text-slate-400 font-mono">{step.time}</span>
                                          </div>
                                          <p className="text-xs text-slate-500 truncate font-mono mt-0.5" title={step.target}>{step.target}</p>
                                      </div>
                                      <span className="text-xs text-slate-400">{step.duration}</span>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Middle: DOM Snapshot */}
                      <div className="flex-1 flex flex-col bg-slate-200 p-4 overflow-hidden relative">
                           <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden relative flex flex-col">
                               <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-2">
                                   <Globe size={14} className="text-slate-400" />
                                   <span className="text-xs text-slate-500 truncate flex-1">https://portal.uitrace.com/login</span>
                               </div>
                               <div className="flex-1 relative bg-white">
                                   {/* Simulate Snapshot Image based on Step */}
                                   <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                       <div className="text-center">
                                            {traceStep === TRACE_STEPS.length - 1 ? (
                                                <AlertTriangle size={64} className="text-rose-300 mx-auto mb-4" />
                                            ) : (
                                                <ImageIcon size={64} className="mx-auto mb-4 opacity-50" />
                                            )}
                                            <p className="font-medium text-slate-400">DOM Snapshot @ {TRACE_STEPS[traceStep].time}</p>
                                            {TRACE_STEPS[traceStep].status === 'fail' && (
                                                <p className="text-rose-500 font-bold mt-2 text-sm bg-rose-50 px-2 py-1 rounded inline-block border border-rose-100">
                                                    Element interactability check failed
                                                </p>
                                            )}
                                       </div>
                                       {/* Mock Highlight Box */}
                                       <div className="absolute top-1/3 left-1/3 w-1/4 h-12 border-2 border-dashed border-blue-400 bg-blue-400/10 rounded pointer-events-none">
                                            <div className="absolute -top-5 left-0 bg-blue-500 text-white text-[10px] px-1 rounded">Target</div>
                                       </div>
                                   </div>
                               </div>
                           </div>
                           
                           {/* Controls */}
                           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800 text-white p-2 rounded-full shadow-xl z-20">
                               <button 
                                onClick={() => setTraceStep(Math.max(0, traceStep - 1))}
                                className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                               >
                                   <ChevronLeft size={16} />
                               </button>
                               <span className="text-xs font-mono font-bold w-16 text-center">
                                   {traceStep + 1} / {TRACE_STEPS.length}
                               </span>
                               <button 
                                onClick={() => setTraceStep(Math.min(TRACE_STEPS.length - 1, traceStep + 1))}
                                className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                               >
                                   <SkipForward size={16} />
                               </button>
                           </div>
                      </div>

                      {/* Right: Metadata Panel */}
                      <div className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0">
                          <div className="flex border-b border-slate-200">
                              <button className="flex-1 py-2 text-xs font-bold text-blue-600 border-b-2 border-blue-600">Console</button>
                              <button className="flex-1 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Network</button>
                              <button className="flex-1 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Source</button>
                          </div>
                          <div className="flex-1 bg-slate-50 p-2 font-mono text-[10px] overflow-y-auto space-y-1">
                               {traceStep === TRACE_STEPS.length - 1 && (
                                   <div className="text-rose-600 bg-rose-50 p-1 border border-rose-100 rounded break-all">
                                       Error: Timeout 15000ms exceeded.<br/>
                                       waiting for selector "#submit-login-v2"<br/>
                                       node is detached.
                                   </div>
                               )}
                               <div className="text-slate-500">&gt; Loaded resource: main.js</div>
                               <div className="text-slate-500">&gt; XHR finished loading: GET "/api/config"</div>
                               {traceStep > 1 && <div className="text-blue-600">&gt; [Tracking] User input detected</div>}
                          </div>
                      </div>

                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default TestResult;