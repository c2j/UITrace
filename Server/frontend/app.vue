<template>
  <NuxtPage />
</template>

<script setup>
// Set up initial theme
const colorMode = useColorMode()
colorMode.preference = 'system'
</script>