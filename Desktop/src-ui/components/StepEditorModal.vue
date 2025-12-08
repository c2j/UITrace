<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">Edit Step</h3>
          <button
            @click="close"
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="px-6 py-4">
        <div class="space-y-6">
          <!-- Basic Step Information -->
          <div>
            <h4 class="text-md font-medium text-gray-900 mb-3">Step Information</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Step Name</label>
                <input
                  v-model="editedStep.name"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter step name"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
                <select
                  v-model="editedStep.action"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="navigate">Navigate</option>
                  <option value="click">Click</option>
                  <option value="type">Type</option>
                  <option value="wait">Wait</option>
                  <option value="scroll">Scroll</option>
                  <option value="select">Select</option>
                </select>
              </div>
            </div>
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                v-model="editedStep.description"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
                placeholder="Enter step description"
              ></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Timeout (seconds)</label>
                <input
                  v-model.number="editedStep.timeout_seconds"
                  type="number"
                  min="1"
                  max="300"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div v-if="editedStep.action === 'type' || editedStep.action === 'wait'">
                <label class="block text-sm font-medium text-gray-700 mb-2">Value</label>
                <input
                  v-model="editedStep.value"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  :placeholder="editedStep.action === 'wait' ? 'Wait time in milliseconds' : 'Enter text value'"
                />
              </div>
            </div>
          </div>

          <!-- Selectors Management -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-md font-medium text-gray-900">Element Selectors</h4>
              <button
                @click="addSelector"
                class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
              >
                <Icon name="heroicons:plus" class="w-4 h-4" />
                Add Selector
              </button>
            </div>

            <div v-if="editedStep.selectors.length === 0" class="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <Icon name="heroicons:cursor-arrow-rays" class="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No selectors defined. Add at least one selector to identify the target element.</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(selector, index) in editedStep.selectors"
                :key="index"
                class="border border-gray-200 rounded-lg p-4"
              >
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 pt-2">
                    <span class="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
                      {{ index + 1 }}
                    </span>
                  </div>
                  <div class="flex-1 space-y-3">
                    <div class="grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Selector Type</label>
                        <select
                          v-model="selector.selector_type"
                          class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="id">ID</option>
                          <option value="css">CSS</option>
                          <option value="xpath">XPath</option>
                          <option value="link_text">Link Text</option>
                          <option value="partial_link_text">Partial Link Text</option>
                          <option value="tag">Tag Name</option>
                          <option value="class">Class Name</option>
                          <option value="name">Name</option>
                        </select>
                      </div>
                      <div class="col-span-2">
                        <label class="block text-xs font-medium text-gray-700 mb-1">Selector Value</label>
                        <input
                          v-model="selector.value"
                          type="text"
                          class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter selector value"
                        />
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <label class="text-xs font-medium text-gray-700">Priority:</label>
                        <input
                          v-model.number="selector.priority"
                          type="number"
                          min="1"
                          max="10"
                          class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span class="text-xs text-gray-500">(Lower = Higher priority)</span>
                      </div>
                      <button
                        @click="removeSelector(index)"
                        class="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                      >
                        <Icon name="heroicons:trash" class="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selector Priority Helper -->
            <div class="mt-4 p-3 bg-blue-50 rounded-lg">
              <h5 class="text-sm font-medium text-blue-900 mb-2">Selector Priority Guidelines:</h5>
              <ul class="text-xs text-blue-800 space-y-1">
                <li>• <strong>Priority 1-2:</strong> Unique identifiers (ID, data-testid)</li>
                <li>• <strong>Priority 3-4:</strong> Stable CSS selectors (classes, attributes)</li>
                <li>• <strong>Priority 5-6:</strong> XPath with specific conditions</li>
                <li>• <strong>Priority 7-8:</strong> Text-based selectors (link text)</li>
                <li>• <strong>Priority 9-10:</strong> Generic selectors (tag names)</li>
              </ul>
            </div>
          </div>

          <!-- Metadata -->
          <div>
            <h4 class="text-md font-medium text-gray-900 mb-3">Additional Metadata</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Expected Value</label>
                <input
                  v-model="editedStep.expected_value"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Expected result (optional)"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Retry Count</label>
                <input
                  v-model.number="editedStep.retry_count"
                  type="number"
                  min="1"
                  max="5"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          @click="close"
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="save"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  step: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:step', 'close', 'save'])

const editedStep = ref({
  step_id: 0,
  name: '',
  action: 'click',
  description: '',
  value: null,
  expected_value: null,
  timeout_seconds: 30,
  retry_count: 3,
  selectors: [],
  metadata: {}
})

// Watch for step changes and initialize form
watch(() => props.step, (newStep) => {
  if (newStep && Object.keys(newStep).length > 0) {
    editedStep.value = {
      ...editedStep.value,
      ...newStep,
      selectors: newStep.selectors || []
    }
  }
}, { immediate: true })

const close = () => {
  emit('close')
}

const save = () => {
  // Validate selectors
  if (editedStep.value.selectors.length === 0) {
    alert('Please add at least one selector for this step.')
    return
  }

  // Sort selectors by priority
  editedStep.value.selectors.sort((a, b) => a.priority - b.priority)

  emit('save', editedStep.value)
  close()
}

const addSelector = () => {
  editedStep.value.selectors.push({
    selector_type: 'css',
    value: '',
    priority: editedStep.value.selectors.length + 1
  })
}

const removeSelector = (index) => {
  editedStep.value.selectors.splice(index, 1)
  // Renumber priorities
  editedStep.value.selectors.forEach((selector, i) => {
    selector.priority = i + 1
  })
}
</script>

<style scoped>
/* Custom scrollbar for modal content */
.max-h-\[90vh\] {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

.max-h-\[90vh\]::-webkit-scrollbar {
  width: 8px;
}

.max-h-\[90vh\]::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}
</style>