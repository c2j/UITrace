import React, { useState, useEffect } from 'react';
import { Play, Save, Circle, GripVertical, Trash2, Plus, Globe, MousePointer, Keyboard, Type, Camera, Eye, Loader2, CheckCircle2, Settings2, Box, GitBranch, ChevronRight, FileText, Tag, Hash, AlertCircle, X, Link as LinkIcon, Flag } from 'lucide-react';
import { MOCK_SCRIPT_STEPS } from '../constants';
import { ActionType, ScriptStep, Locator } from '../types';
import { useNavigate } from 'react-router-dom';

const getActionIcon = (action: ActionType) => {
  switch (action) {
    case ActionType.NAVIGATE: return <Globe size={16} className="text-blue-500" />;
    case ActionType.CLICK: return <MousePointer size={16} className="text-orange-500" />;
    case ActionType.TYPE: return <Keyboard size={16} className="text-purple-500" />;
    case ActionType.ASSERT_TEXT: return <Type size={16} className="text-emerald-500" />;
    case ActionType.SCREENSHOT: return <Camera size={16} className="text-slate-500" />;
    default: return <Circle size={16} />;
  }
};

const ScriptEditor: React.FC = () => {
  const navigate = useNavigate();
  
  // Script Metadata State
  const [metadata, setMetadata] = useState({
      id: 'TC001',
      name: 'Successful Login',
      module: 'Authentication',
      priority: 'P0',
      description: 'Verify that a registered user can log in with valid credentials and land on the dashboard.',
      tags: ['smoke', 'regression', 'login'],
      linkedIssue: 'JIRA-4289'
  });

  const [steps, setSteps] = useState<ScriptStep[]>(MOCK_SCRIPT_STEPS);
  const [selectedStepId, setSelectedStepId] = useState<number>(MOCK_SCRIPT_STEPS[0].id);
  const [isRunning, setIsRunning] = useState(false);
  const [runningStepIndex, setRunningStepIndex] = useState<number>(-1);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);

  const selectedStep = steps.find(s => s.id === selectedStepId);

  const handleRun = () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setRunningStepIndex(0);
    setSelectedStepId(steps[0].id);

    // Simulate step-by-step execution
    let current = 0;
    const interval = setInterval(() => {
      current++;
      if (current >= steps.length) {
        clearInterval(interval);
        setTimeout(() => {
            setIsRunning(false);
            setRunningStepIndex(-1);
            navigate('/results');
        }, 800);
      } else {
        setRunningStepIndex(current);
        setSelectedStepId(steps[current].id);
      }
    }, 1000); // 1 second per step
  };

  const handleSaveMetadata = (e: React.FormEvent) => {
      e.preventDefault();
      // In a real app, this would save to the backend
      setIsPropertiesOpen(false);
  };

  // Helper to render locator badge
  const LocatorBadge = ({ type }: { type: string }) => {
    const colors = {
      id: 'bg-indigo-100 text-indigo-700',
      css: 'bg-pink-100 text-pink-700',
      xpath: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[type as keyof typeof colors] || 'bg-gray-100'}`}>
        {type}
      </span>
    );
  };

  const getPriorityColor = (p: string) => {
      switch(p) {
          case 'P0': return 'bg-rose-100 text-rose-700 border-rose-200';
          case 'P1': return 'bg-orange-100 text-orange-700 border-orange-200';
          default: return 'bg-blue-100 text-blue-700 border-blue-200';
      }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      
      {/* Properties Modal */}
      {isPropertiesOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-20 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <div>
                        <h2 className="text-lg font-bold text-slate-800">Script Properties</h2>
                        <p className="text-xs text-slate-500">Configure metadata and associations for this test case.</p>
                      </div>
                      <button onClick={() => setIsPropertiesOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded transition-colors">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSaveMetadata} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                      {/* Identity Section */}
                      <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ID</label>
                              <div className="relative">
                                  <Hash size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                  <input 
                                    type="text" 
                                    value={metadata.id}
                                    onChange={(e) => setMetadata({...metadata, id: e.target.value})}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                  />
                              </div>
                          </div>
                          <div className="col-span-3">
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Test Case Name</label>
                               <input 
                                    type="text" 
                                    value={metadata.name}
                                    onChange={(e) => setMetadata({...metadata, name: e.target.value})}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                                  />
                          </div>
                      </div>

                      {/* Context Section */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Module</label>
                               <select 
                                    value={metadata.module}
                                    onChange={(e) => setMetadata({...metadata, module: e.target.value})}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                               >
                                   <option>Authentication</option>
                                   <option>Checkout</option>
                                   <option>Search</option>
                                   <option>User Profile</option>
                               </select>
                          </div>
                          <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                               <div className="flex gap-2">
                                   {['P0', 'P1', 'P2'].map(p => (
                                       <button
                                            key={p}
                                            type="button"
                                            onClick={() => setMetadata({...metadata, priority: p})}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-all ${
                                                metadata.priority === p 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                       >
                                           {p}
                                       </button>
                                   ))}
                               </div>
                          </div>
                      </div>

                      {/* Description */}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description / Objective</label>
                          <textarea 
                             rows={3}
                             value={metadata.description}
                             onChange={(e) => setMetadata({...metadata, description: e.target.value})}
                             className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                             placeholder="Describe the purpose of this test case..."
                          />
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Linked Issue (JIRA)</label>
                              <div className="relative">
                                  <LinkIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                  <input 
                                    type="text" 
                                    value={metadata.linkedIssue}
                                    onChange={(e) => setMetadata({...metadata, linkedIssue: e.target.value})}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. PROJ-123"
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags</label>
                              <div className="relative">
                                  <Tag size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                  <input 
                                    type="text" 
                                    value={metadata.tags.join(', ')}
                                    onChange={(e) => setMetadata({...metadata, tags: e.target.value.split(',').map(t => t.trim())})}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="smoke, login, regression"
                                  />
                              </div>
                          </div>
                      </div>

                  </form>

                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                      <button 
                        type="button"
                        onClick={() => setIsPropertiesOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleSaveMetadata}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-colors"
                      >
                          Save Changes
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Toolbar */}
      <div className="h-16 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            {/* Project Context Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1"><Box size={10} /> E-Commerce Storefront</span>
                <ChevronRight size={10} className="text-slate-300"/>
                <span className="flex items-center gap-1"><GitBranch size={10} /> v2.1.0</span>
                <ChevronRight size={10} className="text-slate-300"/>
                <span className="text-blue-600 bg-blue-50 px-1 rounded">{metadata.module}</span>
            </div>
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsPropertiesOpen(true)}>
                <h1 className="text-sm font-bold text-slate-800 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                  {metadata.id} - {metadata.name}
                  <Settings2 size={14} className="text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"/>
                </h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityColor(metadata.priority)}`}>
                    {metadata.priority}
                </span>
                {metadata.tags.length > 0 && (
                     <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500 font-medium border border-slate-200 flex items-center gap-1">
                        <Tag size={8}/> {metadata.tags[0]} {metadata.tags.length > 1 && `+${metadata.tags.length - 1}`}
                     </span>
                )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-100 rounded-md px-2 py-1 mr-4 border border-slate-200">
             <span className="text-xs text-slate-500 mr-2">Data Source:</span>
             <span className="text-xs font-mono font-medium text-slate-700">users_prod.csv</span>
          </div>

          <button 
            onClick={() => navigate('/record')}
            disabled={isRunning}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-slate-300 
                ${isRunning ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}
            `}
          >
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-slate-300' : 'bg-red-500'}`} />
            <span>Start Recording</span>
          </button>

          <button 
            onClick={handleRun}
            disabled={isRunning}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-all
                ${isRunning 
                    ? 'bg-blue-500 text-white cursor-wait opacity-90' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }
            `}
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{isRunning ? 'Running...' : 'Run'}</span>
          </button>
          
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100">
            <Save size={18} />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left: Step List */}
        <div className="w-1/4 border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase">Test Steps</span>
            <button className="p-1 hover:bg-slate-200 rounded">
              <Plus size={14} className="text-slate-600" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {steps.map((step, index) => {
              const isActiveRunning = isRunning && runningStepIndex === index;
              const isCompleted = isRunning && runningStepIndex > index;

              return (
                <div 
                  key={step.id}
                  onClick={() => !isRunning && setSelectedStepId(step.id)}
                  className={`group flex items-center p-3 rounded-lg border transition-all relative overflow-hidden
                    ${isActiveRunning 
                        ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' 
                        : selectedStepId === step.id 
                            ? 'bg-white border-blue-200 shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm cursor-pointer'
                    }
                  `}
                >
                  {/* Progress Bar Background for running step */}
                  {isActiveRunning && (
                     <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 animate-[width_1s_ease-in-out_forwards] w-0" style={{ animationDuration: '1s' }} />
                  )}

                  <div className="text-slate-300 mr-2 cursor-grab active:cursor-grabbing">
                    <GripVertical size={14} />
                  </div>
                  
                  <div className={`w-6 h-6 rounded flex items-center justify-center mr-3 shrink-0 shadow-sm transition-colors
                     ${isCompleted ? 'bg-emerald-100 text-emerald-600 border-emerald-200 border' : 'bg-white border border-slate-100'}
                  `}>
                    {isActiveRunning ? (
                        <Loader2 size={14} className="animate-spin text-blue-600" />
                    ) : isCompleted ? (
                        <CheckCircle2 size={14} />
                    ) : (
                        getActionIcon(step.action)
                    )}
                  </div>

                  <div className="flex-1 min-w-0 z-10">
                    <p className={`text-sm font-medium truncate ${
                        isActiveRunning ? 'text-blue-700' : selectedStepId === step.id ? 'text-blue-800' : 'text-slate-700'
                    }`}>
                      {step.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                      {step.action.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400 ml-2">
                    #{index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle: Step Details & Locators */}
        <div className="w-2/4 border-r border-slate-200 flex flex-col bg-white overflow-y-auto">
          {selectedStep ? (
            <div className="p-6 max-w-2xl mx-auto w-full">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                 <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 text-slate-600">
                    {getActionIcon(selectedStep.action)}
                 </span>
                 {selectedStep.name}
              </h2>

              <div className={`space-y-6 transition-opacity ${isRunning ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {/* Step Details Panel */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                           <Settings2 size={14} className="text-slate-500" />
                           Step Configuration
                        </h3>
                        <span className="text-xs text-slate-400 font-mono">ID: {selectedStep.id}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                         {/* Action (Read-only for now) */}
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Action</label>
                            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium shadow-sm">
                                {getActionIcon(selectedStep.action)}
                                <span className="capitalize">{selectedStep.action.replace('_', ' ').toLowerCase()}</span>
                            </div>
                         </div>

                         {/* Timeout */}
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Timeout</label>
                            <div className="relative">
                                <input 
                                    key={`timeout-${selectedStep.id}`}
                                    type="number" 
                                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                    defaultValue={selectedStep.timeout}
                                />
                                <span className="absolute right-3 top-2 text-xs text-slate-400 font-medium">sec</span>
                            </div>
                         </div>
                    </div>

                    {/* Value Field (Context Aware) */}
                    {(selectedStep.action === ActionType.NAVIGATE || selectedStep.action === ActionType.TYPE) && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                                {selectedStep.action === ActionType.NAVIGATE ? 'Target URL' : 'Input Value'}
                            </label>
                            <div className="relative group">
                                <input 
                                    key={`val-${selectedStep.id}`}
                                    type="text" 
                                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                    defaultValue={selectedStep.value}
                                    placeholder={selectedStep.action === ActionType.NAVIGATE ? 'https://example.com' : 'Enter text...'}
                                />
                                {((selectedStep.value || '').includes('${')) && (
                                    <div className="absolute right-2 top-2 px-1.5 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] font-bold rounded border border-yellow-200 shadow-sm">
                                        VAR
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5">
                                Supports data binding with <code className="bg-slate-200 px-1 rounded text-slate-600">${'{variable}'}</code> syntax.
                            </p>
                        </div>
                    )}

                    {/* Expected Value Field */}
                    {selectedStep.action === ActionType.ASSERT_TEXT && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Expected Result</label>
                            <div className="relative">
                                <input 
                                    key={`exp-${selectedStep.id}`}
                                    type="text" 
                                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-emerald-50/30 border-emerald-200/50"
                                    defaultValue={selectedStep.expectedValue}
                                    placeholder="Expected text content..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Smart Locators Section */}
                {selectedStep.selectors && selectedStep.selectors.length > 0 && (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                Smart Locators
                                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-normal">Self-Healing Enabled</span>
                            </h3>
                            <button className="text-blue-600 text-xs font-medium hover:underline">+ Add Strategy</button>
                        </div>
                        
                        <div className="space-y-2">
                            {selectedStep.selectors.sort((a,b) => a.priority - b.priority).map((loc) => (
                                <div key={loc.priority} className="flex items-center gap-3 bg-white p-2 rounded border border-slate-200 shadow-sm">
                                    <div className="flex-none w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">
                                        {loc.priority}
                                    </div>
                                    <div className="flex-none w-16">
                                        <LocatorBadge type={loc.type} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <input 
                                            type="text" 
                                            value={loc.value}
                                            readOnly
                                            className="w-full text-xs font-mono text-slate-600 bg-transparent border-none focus:ring-0 p-0"
                                        />
                                    </div>
                                    <button className="text-slate-400 hover:text-red-500 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">Select a step to edit</div>
          )}
        </div>

        {/* Right: Mock Preview */}
        <div className="w-1/4 bg-slate-100 flex flex-col transition-colors duration-500" style={isRunning ? {backgroundColor: '#f1f5f9'} : {}}>
            <div className="h-8 bg-slate-200 flex items-center px-3 border-b border-slate-300">
                <div className="flex space-x-1.5 mr-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                </div>
                <div className="flex-1 bg-white h-5 rounded text-[10px] flex items-center px-2 text-slate-400 truncate">
                    {isRunning ? 'https://portal.uitrace.com/...' : 'about:blank'}
                </div>
            </div>
            <div className="flex-1 p-4 flex flex-col items-center justify-center text-slate-400 space-y-4 relative overflow-hidden">
                {isRunning ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mb-4"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            </div>
                        </div>
                        <p className="text-sm font-semibold text-slate-600">Executing Step #{runningStepIndex + 1}</p>
                        <p className="text-xs text-slate-500 mt-1 font-mono bg-slate-200 px-2 py-1 rounded">
                            {selectedStep?.name}
                        </p>
                        
                        {/* Fake Console Output */}
                        <div className="mt-8 w-full max-w-[200px] text-[10px] font-mono text-slate-400 opacity-60">
                            <div>&gt; Locating element...</div>
                            {runningStepIndex % 2 === 0 && <div>&gt; Element found (id)</div>}
                            {runningStepIndex % 2 !== 0 && <div>&gt; Interaction success</div>}
                        </div>
                    </div>
                ) : (
                    <>
                        <Eye size={48} className="opacity-20" />
                        <p className="text-sm text-center px-8">
                            Browser preview is paused. <br/>
                            Run the test or start recording to see live interaction.
                        </p>
                        <div className="w-48 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-200/50">
                            <span className="text-xs">Snapshot Placeholder</span>
                        </div>
                    </>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default ScriptEditor;