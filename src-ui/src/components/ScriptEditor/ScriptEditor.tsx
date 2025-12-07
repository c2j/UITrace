import React, { useState, useEffect } from 'react';
import { TestScript, TestStep } from '../../types/script';
import { TauriService } from '../../services/tauri';
import { StepList } from './StepList';
import { StepEditor } from './StepEditor';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';

interface ScriptEditorProps {
  script?: TestScript;
  onSave: (script: TestScript) => void;
  onCancel: () => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  script,
  onSave,
  onCancel,
}) => {
  const [currentScript, setCurrentScript] = useState<TestScript>(
    script || {
      id: '',
      name: '',
      description: '',
      steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
    }
  );

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);

  useEffect(() => {
    // Load recording status on mount
    loadRecordingStatus();
  }, []);

  const loadRecordingStatus = async () => {
    try {
      const status = await TauriService.getRecordingStatus();
      setIsRecording(status.status === 'recording');
    } catch (error) {
      console.error('Failed to load recording status:', error);
    }
  };

  const handleNameChange = (name: string) => {
    setCurrentScript(prev => ({
      ...prev,
      name,
      updated_at: new Date().toISOString(),
    }));
  };

  const handleDescriptionChange = (description: string) => {
    setCurrentScript(prev => ({
      ...prev,
      description,
      updated_at: new Date().toISOString(),
    }));
  };

  const handleStepUpdate = (updatedStep: TestStep) => {
    setCurrentScript(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === updatedStep.id ? updatedStep : step
      ),
      updated_at: new Date().toISOString(),
    }));
  };

  const handleStepDelete = (stepId: string) => {
    setCurrentScript(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== stepId),
      updated_at: new Date().toISOString(),
    }));
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
    }
  };

  const handleStepAdd = () => {
    const newStep: TestStep = {
      id: `step_${Date.now()}`,
      action: 'click',
      selectors: [],
      order_index: currentScript.steps.length,
    };

    setCurrentScript(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
      updated_at: new Date().toISOString(),
    }));
    setSelectedStepId(newStep.id);
  };

  const handleStepReorder = (steps: TestStep[]) => {
    setCurrentScript(prev => ({
      ...prev,
      steps: steps.map((step, index) => ({
        ...step,
        order_index: index,
      })),
      updated_at: new Date().toISOString(),
    }));
  };

  const startRecording = async () => {
    try {
      const sessionName = currentScript.name || 'New Recording';
      await TauriService.startRecording(sessionName);
      setIsRecording(true);
      setShowRecordingModal(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      const session = await TauriService.stopRecording();
      setIsRecording(false);
      setShowRecordingModal(false);

      // Add recorded steps to the script
      if (session.steps && session.steps.length > 0) {
        setCurrentScript(prev => ({
          ...prev,
          steps: [...prev.steps, ...session.steps],
          updated_at: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording. Please try again.');
    }
  };

  const handleSave = () => {
    if (!currentScript.name.trim()) {
      alert('Please enter a script name');
      return;
    }
    onSave(currentScript);
  };

  const selectedStep = currentScript.steps.find(step => step.id === selectedStepId);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Script Info and Step List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Script Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {script ? 'Edit Script' : 'Create Script'}
          </h1>

          <div className="space-y-4">
            <Input
              label="Script Name"
              value={currentScript.name}
              onChange={handleNameChange}
              placeholder="Enter script name"
              required
            />

            <Input
              label="Description"
              value={currentScript.description || ''}
              onChange={handleDescriptionChange}
              placeholder="Enter script description (optional)"
            />
          </div>

          {/* Recording Controls */}
          <div className="mt-6 space-y-2">
            {!isRecording ? (
              <Button onClick={startRecording} variant="success" className="w-full">
                Start Recording
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="danger" className="w-full">
                Stop Recording
              </Button>
            )}
          </div>
        </div>

        {/* Step List */}
        <div className="flex-1 overflow-hidden">
          <StepList
            steps={currentScript.steps}
            selectedStepId={selectedStepId}
            onStepSelect={setSelectedStepId}
            onStepDelete={handleStepDelete}
            onStepReorder={handleStepReorder}
          />
        </div>

        {/* Add Step Button */}
        <div className="p-4 border-t border-gray-200">
          <Button onClick={handleStepAdd} variant="secondary" className="w-full">
            Add Step
          </Button>
        </div>
      </div>

      {/* Right Panel - Step Editor */}
      <div className="flex-1 flex flex-col">
        {selectedStep ? (
          <StepEditor
            step={selectedStep}
            onStepUpdate={handleStepUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 text-lg">Select a step to edit</p>
              <p className="text-gray-400 mt-2">or add a new step to get started</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-6 bg-white border-t border-gray-200 flex justify-end space-x-4">
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="primary">
            Save Script
          </Button>
        </div>
      </div>

      {/* Recording Modal */}
      <Modal
        isOpen={showRecordingModal}
        onClose={() => setShowRecordingModal(false)}
        title="Recording in Progress"
        showCloseButton={false}
      >
        <div className="text-center">
          <div className="animate-pulse bg-red-500 rounded-full h-4 w-4 mx-auto mb-4"></div>
          <p className="text-gray-700 mb-4">
            Recording your interactions. Click "Stop Recording" when you're done.
          </p>
          <Button onClick={stopRecording} variant="danger">
            Stop Recording
          </Button>
        </div>
      </Modal>
    </div>
  );
};