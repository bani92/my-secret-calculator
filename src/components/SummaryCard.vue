<template>
  <article class="summary-card">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>
