import React, { useState } from 'react';
import { TestStep, Selector, StepAction } from '../../types/script';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';

interface StepEditorProps {
  step: TestStep;
  onStepUpdate: (step: TestStep) => void;
}

export const StepEditor: React.FC<StepEditorProps> = ({ step, onStepUpdate }) => {
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [editingSelector, setEditingSelector] = useState<Selector | null>(null);

  const actionOptions: StepAction[] = [
    'click',
    'type',
    'navigate',
    'scroll',
    'wait',
    'hover',
    'double_click',
    'right_click',
    'select',
    'upload_file',
  ];

  const selectorStrategies = [
    'id',
    'class',
    'xpath',
    'css',
    'text',
    'data_attribute',
    'aria_label',
    'placeholder',
    'name',
  ];

  const handleActionChange = (action: StepAction) => {
    onStepUpdate({
      ...step,
      action,
      // Clear value when action changes to prevent invalid data
      value: undefined,
      wait_time: undefined,
    });
  };

  const handleValueChange = (value: string) => {
    onStepUpdate({
      ...step,
      value,
    });
  };

  const handleWaitTimeChange = (waitTime: string) => {
    const time = parseInt(waitTime) || 0;
    onStepUpdate({
      ...step,
      wait_time: time,
    });
  };

  const handleSelectorAdd = () => {
    const newSelector: Selector = {
      strategy: 'css',
      value: '',
      confidence: 1.0,
      priority: step.selectors.length,
    };
    setEditingSelector(newSelector);
    setShowSelectorModal(true);
  };

  const handleSelectorEdit = (selector: Selector) => {
    setEditingSelector({ ...selector });
    setShowSelectorModal(true);
  };

  const handleSelectorSave = () => {
    if (!editingSelector) return;

    const updatedSelectors = editingSelector.priority !== undefined
      ? step.selectors.map(s => s.priority === editingSelector.priority ? editingSelector : s)
      : [...step.selectors, editingSelector];

    onStepUpdate({
      ...step,
      selectors: updatedSelectors,
    });

    setShowSelectorModal(false);
    setEditingSelector(null);
  };

  const handleSelectorDelete = (priority: number) => {
    const updatedSelectors = step.selectors
      .filter(s => s.priority !== priority)
      .map((s, index) => ({ ...s, priority: index }));

    onStepUpdate({
      ...step,
      selectors: updatedSelectors,
    });
  };

  const getActionSpecificFields = () => {
    switch (step.action) {
      case 'type':
        return (
          <Input
            label="Text to Type"
            value={step.value || ''}
            onChange={handleValueChange}
            placeholder="Enter text to type"
            required
          />
        );

      case 'navigate':
        return (
          <Input
            label="URL"
            value={step.value || ''}
            onChange={handleValueChange}
            placeholder="https://example.com"
            type="url"
            required
          />
        );

      case 'wait':
        return (
          <Input
            label="Wait Time (ms)"
            value={step.wait_time?.toString() || '1000'}
            onChange={handleWaitTimeChange}
            type="number"
            placeholder="1000"
            required
          />
        );

      case 'select':
        return (
          <Input
            label="Value to Select"
            value={step.value || ''}
            onChange={handleValueChange}
            placeholder="Enter value to select"
            required
          />
        );

      case 'upload_file':
        return (
          <Input
            label="File Path"
            value={step.value || ''}
            onChange={handleValueChange}
            placeholder="/path/to/file.txt"
            required
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Step Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Edit Step
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              value={step.action}
              onChange={(e) => handleActionChange(e.target.value as StepAction)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {getActionSpecificFields()}
        </div>
      </div>

      {/* Selectors Section */}
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Element Selectors
            </h3>
            <Button onClick={handleSelectorAdd} variant="secondary" size="sm">
              Add Selector
            </Button>
          </div>

          {step.selectors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No selectors configured</p>
              <p className="text-gray-400 text-sm">
                Add selectors to identify the target element for this action
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {step.selectors.map((selector, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700">
                      {selector.strategy.toUpperCase()}
                    </span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {selector.value}
                    </code>
                    <span className="text-xs text-gray-500">
                      Confidence: {(selector.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSelectorEdit(selector)}
                      className="text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleSelectorDelete(selector.priority)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selector Edit Modal */}
      <Modal
        isOpen={showSelectorModal}
        onClose={() => setShowSelectorModal(false)}
        title={editingSelector?.priority !== undefined ? 'Edit Selector' : 'Add Selector'}
      >
        {editingSelector && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Strategy
              </label>
              <select
                value={editingSelector.strategy}
                onChange={(e) => setEditingSelector({
                  ...editingSelector,
                  strategy: e.target.value as any,
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {selectorStrategies.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategy.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Selector Value"
              value={editingSelector.value}
              onChange={(value) => setEditingSelector({
                ...editingSelector,
                value,
              })}
              placeholder="Enter selector value"
              required
            />

            <Input
              label="Confidence (0.0 - 1.0)"
              value={editingSelector.confidence.toString()}
              onChange={(value) => setEditingSelector({
                ...editingSelector,
                confidence: parseFloat(value) || 1.0,
              })}
              type="number"
              required
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                onClick={() => setShowSelectorModal(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button onClick={handleSelectorSave} variant="primary">
                Save Selector
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};