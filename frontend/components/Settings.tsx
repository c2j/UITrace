import React, { useState } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Database, Layout, Save, Globe, Moon, Lock, Mail, Slack, Trash2, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success'>('idle');
  const [apiKey, setApiKey] = useState('sk_live_...4x9s');

  const tabs = [
    { id: 'general', label: 'General', icon: Layout },
    { id: 'execution', label: 'Execution', icon: SettingsIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'data', label: 'Data & Storage', icon: Database },
  ];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
        setIsSaving(false);
        setToast({ message: 'Settings saved successfully', type: 'success' });
        setTimeout(() => setToast(null), 3000);
    }, 1200);
  };

  const handleTestConnection = () => {
    setTestConnectionStatus('testing');
    setTimeout(() => {
        setTestConnectionStatus('success');
        setTimeout(() => setTestConnectionStatus('idle'), 3000);
    }, 1500);
  };

  const handleGenerateKey = () => {
      setApiKey(`sk_live_${Math.random().toString(36).substr(2, 8)}...8z2k`);
      setToast({ message: 'New API Key generated', type: 'success' });
      setTimeout(() => setToast(null), 3000);
  };

  const showFeatureToast = () => {
      setToast({ message: 'Feature not implemented in demo', type: 'error' });
      setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="flex h-full bg-slate-50 relative">
      
      {/* Toast Notification */}
      {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom fade-in duration-300">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-white ${
                  toast.type === 'success' ? 'bg-slate-800 border-slate-700' : 'bg-rose-600 border-rose-500'
              }`}>
                  {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400"/> : <Lock size={18} />}
                  <span className="text-sm font-medium">{toast.message}</span>
              </div>
          </div>
      )}

      {/* Settings Navigation */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">System Settings</h2>
            <p className="text-xs text-slate-500 mt-1">Configure global preferences.</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
            {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                            ${activeTab === tab.id 
                                ? 'bg-blue-50 text-blue-700' 
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <Icon size={18} className={activeTab === tab.id ? 'text-blue-500' : 'text-slate-400'} />
                        {tab.label}
                    </button>
                );
            })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-8">
            
            {/* Header for Active Section */}
            <div className="flex justify-between items-center pb-6 border-b border-slate-200">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">{tabs.find(t => t.id === activeTab)?.label} Settings</h3>
                    <p className="text-sm text-slate-500 mt-1">Manage configuration for {activeTab} parameters.</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm active:scale-95 transition-all disabled:opacity-70 disabled:cursor-wait"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Appearance & Branding</h4>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                                    U
                                </div>
                                <button onClick={showFeatureToast} className="text-xs text-blue-600 hover:underline">Change Logo</button>
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Application Name</label>
                                    <input type="text" defaultValue="UITrace Web Console" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Theme Preference</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="theme" defaultChecked className="text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm text-slate-600">Light</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="theme" className="text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm text-slate-600">Dark</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="theme" className="text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm text-slate-600">System</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>

                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Localization</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none">
                                    <option>UTC (Coordinated Universal Time)</option>
                                    <option>PST (Pacific Standard Time)</option>
                                    <option>EST (Eastern Standard Time)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date Format</label>
                                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none">
                                    <option>YYYY-MM-DD</option>
                                    <option>DD/MM/YYYY</option>
                                    <option>MM/DD/YYYY</option>
                                </select>
                            </div>
                         </div>
                     </div>
                </div>
            )}

            {/* Execution Tab */}
            {activeTab === 'execution' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Timeouts & Retries</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Global Command Timeout (ms)</label>
                                <input 
                                    type="number" 
                                    defaultValue={15000}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" 
                                />
                                <p className="text-xs text-slate-500 mt-1">Default wait time for element visibility.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Page Load Timeout (ms)</label>
                                <input 
                                    type="number" 
                                    defaultValue={60000}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Retry Count on Failure</label>
                                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                                    <option>0 (No Retry)</option>
                                    <option>1 Retry</option>
                                    <option selected>2 Retries</option>
                                    <option>3 Retries</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Browser Strategy</h4>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Headless Mode</label>
                                    <p className="text-xs text-slate-500">Run browsers without visible UI for faster execution.</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input type="checkbox" name="toggle" id="toggle-headless" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-blue-500 right-0 checked:right-0"/>
                                    <label htmlFor="toggle-headless" className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-500 cursor-pointer"></label>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Disable Security Sandbox</label>
                                    <p className="text-xs text-slate-500">Required for some CI/CD environments (e.g. Docker).</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input type="checkbox" name="toggle" id="toggle-sandbox" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300"/>
                                    <label htmlFor="toggle-sandbox" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer"></label>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Incognito / Private Mode</label>
                                    <p className="text-xs text-slate-500">Always start fresh sessions without cache/cookies.</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input type="checkbox" name="toggle" id="toggle-incognito" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-blue-500 right-0 checked:right-0"/>
                                    <label htmlFor="toggle-incognito" className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-500 cursor-pointer"></label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                            <Mail size={18} /> Email Alerts
                        </h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-slate-700">Notify on Test Failure</label>
                                <input type="checkbox" className="h-4 w-4 text-blue-600 rounded" defaultChecked />
                            </div>
                             <div className="flex items-center justify-between">
                                <label className="text-sm text-slate-700">Weekly Summary Report</label>
                                <input type="checkbox" className="h-4 w-4 text-blue-600 rounded" defaultChecked />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Recipients (comma separated)</label>
                                <input type="text" defaultValue="qa-team@example.com, dev-leads@example.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                     </div>

                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                            <Slack size={18} /> Slack Integration
                        </h4>
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
                                <input type="password" defaultValue="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-500 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleTestConnection}
                                    disabled={testConnectionStatus === 'testing'}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-2"
                                >
                                    {testConnectionStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : null}
                                    {testConnectionStatus === 'success' ? 'Connected!' : 'Test Connection'}
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
            )}

            {/* Security Tab */}
             {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Access Control</h4>
                        <p className="text-sm text-slate-600">
                            Single Sign-On (SSO) is enabled via Google Workspace.
                        </p>
                        <button onClick={showFeatureToast} className="text-sm text-blue-600 font-medium hover:underline">Configure SSO Provider</button>
                    </div>
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">API Keys</h4>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-200">
                            <div>
                                <p className="text-sm font-bold text-slate-700">Default Agent Key</p>
                                <p className="text-xs text-slate-400 font-mono">{apiKey}</p>
                            </div>
                            <button onClick={showFeatureToast} className="text-rose-500 hover:bg-rose-50 p-2 rounded">
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <button 
                            onClick={handleGenerateKey}
                            className="w-full py-2 border border-dashed border-slate-300 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-300 text-sm font-medium flex items-center justify-center gap-2 group"
                        >
                            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform"/>
                            Generate New API Key
                        </button>
                    </div>
                </div>
            )}

            {/* Data Tab */}
            {activeTab === 'data' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h4 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Data Retention</h4>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Test Results</label>
                                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none">
                                    <option>30 Days</option>
                                    <option>90 Days</option>
                                    <option>1 Year</option>
                                    <option>Forever</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Screenshots & Videos</label>
                                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none">
                                    <option>7 Days</option>
                                    <option>30 Days</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded border border-amber-200">
                            <span className="font-bold">Note:</span> Changing retention policies applies to existing data immediately. Deleted data cannot be recovered.
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Settings;