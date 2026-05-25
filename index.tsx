import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import WolfAiStandaloneApp from './components/wolf-ai/WolfAiStandaloneApp';
import { isWolfAiStandalonePath } from './components/wolf-ai/wolfAiRouting';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const standaloneWolfAi = typeof window !== 'undefined' && isWolfAiStandalonePath(window.location.pathname);
if (standaloneWolfAi) {
  document.title = 'WOLF AI Playground';
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {standaloneWolfAi ? <WolfAiStandaloneApp /> : <App />}
  </React.StrictMode>
);