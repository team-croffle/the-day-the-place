import { createApp } from 'vue';

import App from './app.vue';

import './assets/main.css';
import { i18n } from './i18n';
import { applyStoredFontStep } from './lib/fontScale';
import { router } from './router';

applyStoredFontStep();
createApp(App).use(router).use(i18n).mount('#app');
