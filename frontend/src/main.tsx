import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initAPI } from './services/api';

const savedKey = localStorage.getItem('queryguard_api_key') || '';
if (savedKey) initAPI(savedKey);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
