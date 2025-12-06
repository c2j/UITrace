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
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 overflow-y-auto"
        @click="handleBackdropClick"
      >
        <div class="flex min-h-full items-center justify-center p-4">
          <!-- Backdrop -->
          <Transition
            enter-active-class="transition ease-out duration-300"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition ease-in duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75" />
          </Transition>

          <!-- Modal panel -->
          <Transition
            enter-active-class="transition ease-out duration-300"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-200"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              :class="[
                'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all',
                sizeClasses[size]
              ]"
              @click.stop
            >
              <!-- Header -->
              <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ title }}
                </h3>
                <button
                  @click="handleClose"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Icon name="carbon:close" class="h-6 w-6" />
                </button>
              </div>

              <!-- Body -->
              <div class="px-6 py-4">
                <slot />
              </div>
            </div>
          </Transition>
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
    required: true
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large', 'extra-large'].includes(value)
  }
})

const emit = defineEmits(['update:modelValue', 'close'])

const sizeClasses = {
  small: 'max-w-md w-full',
  medium: 'max-w-2xl w-full',
  large: 'max-w-4xl w-full',
  'extra-large': 'max-w-6xl w-full'
}

const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}

const handleBackdropClick = () => {
  if (props.closeOnBackdrop !== false) {
    handleClose()
  }
}
</script>