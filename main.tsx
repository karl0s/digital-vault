import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PlaygroundRouter } from './PlaygroundRouter';
import './styles/globals.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const isPlayground = window.location.pathname.startsWith(`${base}/playground`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPlayground ? <PlaygroundRouter /> : <App />}
  </React.StrictMode>
);
