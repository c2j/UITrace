import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ScriptEditor from './components/ScriptEditor';
import TestResult from './components/TestResult';
import ServerNodes from './components/ServerNodes';
import Settings from './components/Settings';
import Recorder from './components/Recorder';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Standalone Recorder Route for Full Screen Experience */}
        <Route path="/record" element={<Recorder />} />

        {/* Main Application Layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="editor" element={<ScriptEditor />} />
          <Route path="results" element={<TestResult />} />
          <Route path="server" element={<ServerNodes />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;