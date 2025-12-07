import React from 'react';
import { TestStep } from '../../types/script';
import { StepAction } from '../../types/script';

interface StepListProps {
  steps: TestStep[];
  selectedStepId: string | null;
  onStepSelect: (stepId: string) => void;
  onStepDelete: (stepId: string) => void;
  onStepReorder: (steps: TestStep[]) => void;
}

export const StepList: React.FC<StepListProps> = ({
  steps,
  selectedStepId,
  onStepSelect,
  onStepDelete,
  onStepReorder,
}) => {
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    if (!draggedStepId || draggedStepId === targetStepId) return;

    const draggedIndex = steps.findIndex(step => step.id === draggedStepId);
    const targetIndex = steps.findIndex(step => step.id === targetStepId);

    const newSteps = [...steps];
    const [draggedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, draggedStep);

    onStepReorder(newSteps);
    setDraggedStepId(null);
  };

  const getActionIcon = (action: StepAction) => {
    const icons = {
      click: '👆',
      type: '⌨️',
      navigate: '🌐',
      scroll: '📜',
      wait: '⏱️',
      hover: '🖱️',
      double_click: '👆👆',
      right_click: '🖱️',
      select: '☑️',
      upload_file: '📁',
    };
    return icons[action] || '🔧';
  };

  const getStepDescription = (step: TestStep) => {
    switch (step.action) {
      case 'click':
        return step.target_element?.text_content || 'Click element';
      case 'type':
        return `Type "${step.value || ''}"`;
      case 'navigate':
        return `Navigate to ${step.value || 'URL'}`;
      case 'scroll':
        return `Scroll ${step.value || ''}`;
      case 'wait':
        return `Wait ${step.wait_time || 0}ms`;
      case 'hover':
        return 'Hover over element';
      case 'double_click':
        return 'Double click element';
      case 'right_click':
        return 'Right click element';
      case 'select':
        return `Select "${step.value || ''}"`;
      case 'upload_file':
        return `Upload file: ${step.value || ''}`;
      default:
        return 'Unknown action';
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Steps ({steps.length})
        </h3>

        {steps.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No steps yet</p>
            <p className="text-gray-400 text-xs mt-1">Add steps or start recording</p>
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                draggable
                onDragStart={(e) => handleDragStart(e, step.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, step.id)}
                onClick={() => onStepSelect(step.id)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${
                    selectedStepId === step.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                  ${draggedStepId === step.id ? 'opacity-50' : ''}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="text-xl">{getActionIcon(step.action)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-500">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {step.action.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {getStepDescription(step)}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        {step.selectors.slice(0, 2).map((selector, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {selector.strategy}: {selector.value}
                          </span>
                        ))}
                        {step.selectors.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{step.selectors.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStepDelete(step.id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
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
  );
};

// Add missing import
import { useState } from 'react';