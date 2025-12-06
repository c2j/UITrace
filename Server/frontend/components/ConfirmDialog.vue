<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75" />

          <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full mb-4">
              <Icon name="carbon:warning-alt" class="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>

            <div class="text-center">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {{ title }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ message }}
              </p>
            </div>

            <div class="mt-6 flex space-x-3">
              <button
                @click="handleCancel"
                class="flex-1 btn btn-secondary"
              >
                {{ cancelText }}
              </button>
              <button
                @click="handleConfirm"
                class="flex-1 btn btn-error"
                :disabled="loading"
              >
                <span v-if="loading">
                  <Icon name="carbon:circle-dash" class="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </span>
                <span v-else>{{ confirmText }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Confirm Action'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('update:modelValue', false)
  emit('cancel')
}
</script>