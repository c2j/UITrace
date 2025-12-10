import React, { useState } from 'react';
import { MOCK_NODES } from '../constants';
import { Server, Monitor, Laptop, Cpu, Activity, RefreshCw, Power, Plus, Terminal, X, Clock, Wifi, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { ServerNode } from '../types';

const ServerNodes: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<ServerNode | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = (action: string, nodeId?: string) => {
    setLoadingAction(action + (nodeId || ''));
    
    // Simulate async operation
    setTimeout(() => {
        setLoadingAction(null);
        if (action === 'restart') showToast(`Node ${nodeId ? '' : ''} restarted successfully.`, 'success');
        if (action === 'shutdown') showToast(`Shutdown command sent to node.`, 'info');
        if (action === 'add') showToast(`Agent scan started. Found 1 new device.`, 'success');
    }, 1500);
  };

  const getOsIcon = (os: string) => {
    switch (os) {
      case 'windows': return <Monitor className="text-blue-500" size={20} />;
      case 'linux': return <Server className="text-orange-500" size={20} />;
      case 'mac': return <Laptop className="text-slate-700" size={20} />;
      default: return <Server size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-emerald-500 shadow-emerald-200';
      case 'BUSY': return 'bg-amber-500 shadow-amber-200';
      case 'OFFLINE': return 'bg-slate-300 shadow-slate-200';
      default: return 'bg-slate-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-6 space-y-6 relative">
      
      {/* Toast Notification */}
      {toast && (
          <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-right fade-in duration-300">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
                  toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
                  toast.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                  {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                  <span className="text-sm font-medium">{toast.message}</span>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Execution Nodes</h2>
          <p className="text-sm text-slate-500">Manage distributed execution agents and browser grids.</p>
        </div>
        <button 
            onClick={() => handleAction('add')}
            disabled={!!loadingAction}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loadingAction === 'add' ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />}
          Add Node
        </button>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {MOCK_NODES.map((node) => (
          <div key={node.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
            
            {/* Card Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                    {getOsIcon(node.os)}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">{node.name}</h3>
                    <p className="text-xs font-mono text-slate-400">{node.ip}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                 <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 uppercase tracking-wide
                    ${node.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                    ${node.status === 'BUSY' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                    ${node.status === 'OFFLINE' ? 'bg-slate-100 text-slate-500 border-slate-200' : ''}
                 `}>
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(node.status)} shadow-[0_0_8px]`} />
                    {node.status}
                 </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-4 flex-1">
                {/* Resources */}
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500 flex items-center gap-1"><Cpu size={12}/> CPU Usage</span>
                            <span className="font-mono font-medium text-slate-700">{node.cpuUsage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${node.cpuUsage > 80 ? 'bg-rose-500' : 'bg-blue-500'}`} 
                                style={{ width: `${node.cpuUsage}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500 flex items-center gap-1"><Activity size={12}/> Memory</span>
                            <span className="font-mono font-medium text-slate-700">{node.memUsage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${node.memUsage > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${node.memUsage}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Capabilities */}
                <div className="pt-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Capabilities</p>
                    <div className="flex flex-wrap gap-2">
                        {node.browsers.map(b => (
                            <span key={b} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200 font-medium capitalize">
                                {b}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Card Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs">
                <button 
                  onClick={() => { setSelectedNode(node); setShowConsole(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors font-medium"
                >
                    <Terminal size={14} />
                    Inspect Logs
                </button>
                <div className="flex gap-1">
                    <button 
                        onClick={() => handleAction('restart', node.id)}
                        disabled={!!loadingAction}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                        title="Restart Node"
                    >
                        {loadingAction === 'restart'+node.id ? <Loader2 size={14} className="animate-spin text-blue-600"/> : <RefreshCw size={14} />}
                    </button>
                    <button 
                        onClick={() => handleAction('shutdown', node.id)}
                        disabled={!!loadingAction}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" 
                        title="Shutdown"
                    >
                         {loadingAction === 'shutdown'+node.id ? <Loader2 size={14} className="animate-spin text-rose-600"/> : <Power size={14} />}
                    </button>
                </div>
            </div>
          </div>
        ))}

        {/* Add New Node Placeholder */}
        <button 
            onClick={() => handleAction('add')}
            className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all group min-h-[300px]"
        >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                {loadingAction === 'add' ? <Loader2 size={24} className="animate-spin text-blue-500"/> : <Plus size={24} />}
            </div>
            <span className="font-medium">Connect New Node</span>
            <span className="text-xs mt-1 opacity-70">Install agent on target machine</span>
        </button>
      </div>

      {/* Detail Overlay / Modal (Mock Console) */}
      {showConsole && selectedNode && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
             <div className="bg-slate-900 w-full max-w-4xl h-[600px] rounded-xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <Terminal className="text-emerald-400" size={20} />
                        <div>
                            <h3 className="text-slate-200 font-bold font-mono">{selectedNode.name}</h3>
                            <p className="text-xs text-slate-500 font-mono flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Connection ({selectedNode.ip})
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowConsole(false)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 bg-black/50 p-6 font-mono text-xs overflow-y-auto space-y-2">
                    <div className="text-slate-500">Connecting to agent at {selectedNode.ip}:443... Connected.</div>
                    <div className="text-slate-500">Authenticating... OK.</div>
                    <div className="text-slate-300">Last login: {new Date().toLocaleDateString()} from 10.0.0.5</div>
                    <br/>
                    <div className="text-emerald-400">root@{selectedNode.id}:~# tail -f /var/log/uitrace/agent.log</div>
                    <div className="text-slate-400">[INFO] 2023-10-25 10:15:22 - Heartbeat sent to controller.</div>
                    <div className="text-slate-400">[INFO] 2023-10-25 10:15:30 - Received job "TC-001-Login". Preparing environment.</div>
                    <div className="text-blue-400">[DEBUG] Launching Chrome (Headless)... PID 4521</div>
                    <div className="text-slate-400">[INFO] Browser started in 1.2s.</div>
                    <div className="text-slate-400">[INFO] Navigating to https://portal.uitrace.com...</div>
                    <div className="text-slate-400">[INFO] Step 1 complete.</div>
                    <div className="text-yellow-400 animate-pulse">_</div>
                </div>

                <div className="p-3 bg-slate-800 border-t border-slate-700 flex gap-4 text-xs text-slate-400 font-mono">
                     <span className="flex items-center gap-1"><Cpu size={12}/> {selectedNode.cpuUsage}%</span>
                     <span className="flex items-center gap-1"><Activity size={12}/> {selectedNode.memUsage}%</span>
                     <span className="flex items-center gap-1"><Wifi size={12}/> 45ms ping</span>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default ServerNodes;