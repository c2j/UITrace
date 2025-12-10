import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  StopCircle, Pause, Play, MousePointer, Type, Eye, 
  Camera, Plus, Save, X, Smartphone, Monitor, RotateCcw,
  ArrowLeft, ArrowRight, RefreshCw, Layers
} from 'lucide-react';
import { ActionType, ScriptStep } from '../types';

const Recorder: React.FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('https://portal.uitrace.com/login');
  const [isRecording, setIsRecording] = useState(true);
  const [assertionMode, setAssertionMode] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<ScriptStep[]>([]);
  const [timer, setTimer] = useState(0);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Timer effect
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addStep = (action: ActionType, name: string, value?: string, expected?: string) => {
    const newStep: ScriptStep = {
      id: Date.now(),
      name,
      action,
      value,
      expectedValue: expected,
      timeout: 30,
      selectors: [
        { type: 'css', value: `#${name.toLowerCase().replace(/\s/g, '-')}`, priority: 1 },
        { type: 'xpath', value: `//*[text()='${name}']`, priority: 2 }
      ]
    };
    setRecordedSteps(prev => [...prev, newStep]);
  };

  // Mock interaction handler
  const handleMockClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isRecording) return;

    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const text = target.innerText || target.getAttribute('placeholder') || 'Element';

    if (assertionMode) {
      addStep(ActionType.ASSERT_TEXT, `Verify "${text}"`, undefined, text);
      setAssertionMode(false); // Reset after assertion
    } else {
      if (tagName === 'input') {
        addStep(ActionType.TYPE, `Input ${target.getAttribute('name') || 'Text'}`, 'test_value');
      } else if (tagName === 'button' || tagName === 'a') {
        addStep(ActionType.CLICK, `Click ${text}`);
      } else {
        addStep(ActionType.CLICK, `Click ${text}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* 1. Top Recording Bar */}
      <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shrink-0 shadow-md z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="font-mono text-xl font-medium tracking-widest">{formatTime(timer)}</span>
          </div>
          <div className="h-6 w-px bg-slate-600" />
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsRecording(!isRecording)}
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title={isRecording ? "Pause" : "Resume"}
            >
              {isRecording ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button 
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${assertionMode ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-700 text-slate-300'}`}
              onClick={() => setAssertionMode(!assertionMode)}
              title="Add Assertion"
            >
              <Eye size={20} />
              <span className="text-sm font-medium">Assert</span>
            </button>
            <button 
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              onClick={() => addStep(ActionType.SCREENSHOT, 'Capture Screenshot')}
              title="Take Screenshot"
            >
              <Camera size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <span className="text-xs text-slate-400">Target Session: Chrome 114 (Win 11)</span>
           <button 
             onClick={() => navigate('/editor')}
             className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
           >
             Cancel
           </button>
           <button 
             onClick={() => navigate('/editor')}
             className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-rose-900/20 transition-colors"
           >
             <StopCircle size={18} />
             Finish & Save
           </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* 2. Left Sidebar: Live Steps */}
        <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 z-10">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Recorded Steps</h3>
            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">{recordedSteps.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {recordedSteps.length === 0 && (
              <div className="text-center text-slate-600 mt-10 text-sm italic">
                Interact with the browser on the right to start recording steps...
              </div>
            )}
            {recordedSteps.map((step, index) => (
              <div key={step.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 shadow-sm animate-in slide-in-from-left-2 duration-300">
                 <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-slate-500 mt-0.5">{(index + 1).toString().padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                          {step.action === ActionType.CLICK && <MousePointer size={12} className="text-orange-400"/>}
                          {step.action === ActionType.TYPE && <Type size={12} className="text-purple-400"/>}
                          {step.action === ActionType.ASSERT_TEXT && <Eye size={12} className="text-emerald-400"/>}
                          {step.action === ActionType.SCREENSHOT && <Camera size={12} className="text-blue-400"/>}
                          <span className="text-xs font-bold text-slate-300 uppercase">{step.action.replace('_', ' ')}</span>
                       </div>
                       <p className="text-sm text-white truncate">{step.name}</p>
                       {step.value && <p className="text-xs text-slate-400 font-mono mt-1 truncate">Val: "{step.value}"</p>}
                       {step.expectedValue && <p className="text-xs text-emerald-400/70 font-mono mt-1 truncate">Exp: "{step.expectedValue}"</p>}
                    </div>
                 </div>
              </div>
            ))}
            {/* Auto-scroll anchor */}
            <div className="h-0" />
          </div>
        </div>

        {/* 3. Main Area: Browser Emulator */}
        <div className="flex-1 bg-slate-950 flex flex-col relative">
          
          {/* Browser Toolbar */}
          <div className="h-12 bg-slate-100 flex items-center px-4 gap-4 border-b border-slate-300 shrink-0">
             <div className="flex items-center gap-2 text-slate-500">
                <button className="p-1 hover:bg-slate-200 rounded"><ArrowLeft size={16}/></button>
                <button className="p-1 hover:bg-slate-200 rounded"><ArrowRight size={16}/></button>
                <button className="p-1 hover:bg-slate-200 rounded"><RefreshCw size={16}/></button>
             </div>
             <div className="flex-1 bg-white border border-slate-300 rounded-full h-8 flex items-center px-4 shadow-inner">
                <span className="text-slate-400 mr-2"><Layers size={14}/></span>
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 text-sm text-slate-700 outline-none font-sans"
                />
             </div>
             <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
                <button 
                  onClick={() => setViewport('desktop')}
                  className={`p-1.5 rounded ${viewport === 'desktop' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-200'}`}
                >
                  <Monitor size={18} />
                </button>
                <button 
                  onClick={() => setViewport('mobile')}
                  className={`p-1.5 rounded ${viewport === 'mobile' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-200'}`}
                >
                  <Smartphone size={18} />
                </button>
             </div>
          </div>

          {/* Browser Viewport (The Mock Page) */}
          <div className="flex-1 bg-slate-200 flex justify-center overflow-auto p-8 relative">
             <div 
                className={`bg-white shadow-2xl transition-all duration-300 flex flex-col relative
                  ${viewport === 'desktop' ? 'w-full max-w-5xl h-full rounded-lg' : 'w-[375px] h-[667px] rounded-[3rem] border-[8px] border-slate-800'}
                `}
             >
                {/* Mock Content */}
                <div className={`flex-1 overflow-auto p-12 flex flex-col items-center justify-center font-sans ${viewport === 'mobile' ? 'rounded-[2.5rem]' : ''}`}>
                   
                   {/* Interactive Overlay for Assertion Mode */}
                   {assertionMode && (
                     <div className="absolute inset-0 bg-indigo-500/10 cursor-crosshair z-50 pointer-events-none border-4 border-indigo-500 flex items-start justify-center pt-4">
                        <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg animate-bounce">
                           Select an element to verify
                        </div>
                     </div>
                   )}

                   {/* Fake Login Page */}
                   <div className="w-full max-w-md space-y-8" onClick={handleMockClick}>
                      <div className="text-center">
                         <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                            <span className="text-white text-2xl font-bold">U</span>
                         </div>
                         <h2 className="text-3xl font-bold text-slate-900 pointer-events-none">Welcome Back</h2>
                         <p className="text-slate-500 mt-2 pointer-events-none">Sign in to your UITrace account</p>
                      </div>

                      <div className="space-y-6 mt-8 p-8 bg-white rounded-2xl border border-slate-100 shadow-xl">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 pointer-events-none">Email Address</label>
                            <input 
                              name="email"
                              type="email" 
                              placeholder="you@example.com"
                              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-blue-300 cursor-text"
                              readOnly // Read only so we don't actually type, just capture click
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 pointer-events-none">Password</label>
                            <input 
                              name="password"
                              type="password" 
                              placeholder="••••••••"
                              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-blue-300 cursor-text"
                              readOnly
                            />
                         </div>
                         <div className="flex items-center justify-between">
                            <div className="flex items-center">
                               <input id="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                               <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900 cursor-pointer">Remember me</label>
                            </div>
                            <div className="text-sm">
                               <a href="#" className="font-medium text-blue-600 hover:text-blue-500">Forgot password?</a>
                            </div>
                         </div>
                         <button 
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform active:scale-95"
                         >
                            Sign in
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recorder;