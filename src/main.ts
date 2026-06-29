import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles.css';

createApp(App).use(createPinia()).mount('#app');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
