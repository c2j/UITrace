import { useState, useEffect } from 'react';
import { TestScript } from './types/script';
import { TauriService } from './services/tauri';
import { ScriptEditor } from './components/ScriptEditor/ScriptEditor';
import { Button } from './components/shared/Button';

function App() {
  const [scripts, setScripts] = useState<TestScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<TestScript | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    try {
      setIsLoading(true);
      const loadedScripts = await TauriService.listScripts();
      setScripts(loadedScripts);
    } catch (error) {
      console.error('Failed to load scripts:', error);
      // For now, show a fallback UI
      setScripts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateScript = async () => {
    try {
      const newScript = await TauriService.createScript('New Script', '');
      setSelectedScript(newScript);
      setIsEditing(true);
    } catch (error) {
      console.error('Failed to create script:', error);
      // Fallback: create local script
      const fallbackScript: TestScript = {
        id: `local_${Date.now()}`,
        name: 'New Script',
        description: '',
        steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'draft',
      };
      setSelectedScript(fallbackScript);
      setIsEditing(true);
    }
  };

  const handleEditScript = (script: TestScript) => {
    setSelectedScript(script);
    setIsEditing(true);
  };

  const handleSaveScript = async (script: TestScript) => {
    try {
      await TauriService.saveScript(script);
      await loadScripts();
      setIsEditing(false);
      setSelectedScript(null);
    } catch (error) {
      console.error('Failed to save script:', error);
      // Fallback: just update local state
      const updatedScripts = scripts.map(s =>
        s.id === script.id ? script : s
      );
      if (!scripts.find(s => s.id === script.id)) {
        updatedScripts.push(script);
      }
      setScripts(updatedScripts);
      setIsEditing(false);
      setSelectedScript(null);
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm('Are you sure you want to delete this script?')) return;

    try {
      await TauriService.deleteScript(scriptId);
      await loadScripts();
    } catch (error) {
      console.error('Failed to delete script:', error);
      // Fallback: remove from local state
      setScripts(scripts.filter(s => s.id !== scriptId));
    }
  };

  const handleExecuteScript = async (scriptId: string) => {
    try {
      await TauriService.executeScript(scriptId);
      alert('Script execution started!');
    } catch (error) {
      console.error('Failed to execute script:', error);
      alert('Failed to execute script. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSelectedScript(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isEditing && selectedScript) {
    return (
      <ScriptEditor
        script={selectedScript}
        onSave={handleSaveScript}
        onCancel={handleCancelEdit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">UITrace</h1>
              <p className="text-gray-600 mt-1">Web Automation Script Editor</p>
            </div>
            <Button onClick={handleCreateScript} variant="primary">
              Create New Script
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading scripts...</p>
          </div>
        ) : scripts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scripts yet</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first automation script.</p>
            <Button onClick={handleCreateScript} variant="primary">
              Create Your First Script
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {scripts.map((script) => (
              <div key={script.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{script.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    script.status === 'ready' ? 'bg-green-100 text-green-800' :
                    script.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    script.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    script.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {script.status}
                  </span>
                </div>

                {script.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{script.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Steps:</span>
                    <span className="font-medium">{script.steps.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Created:</span>
                    <span className="font-medium">{formatDate(script.created_at)}</span>
                  </div>
                  {script.tags && script.tags.length > 0 && (
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-gray-500 text-sm">Tags:</span>
                      <div className="flex flex-wrap gap-1">
                        {script.tags.map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleEditScript(script)}
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleExecuteScript(script.id)}
                    variant="primary"
                    size="sm"
                    className="flex-1"
                  >
                    Run
                  </Button>
                  <Button
                    onClick={() => handleDeleteScript(script.id)}
                    variant="danger"
                    size="sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;