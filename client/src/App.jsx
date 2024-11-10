import { useState } from 'react';
import Navbar from "./components/Navbar";
import NewTestButton from "./components/NewTestButton";
import TestCreation from './TestCreation';
import { Routes, Route } from 'react-router-dom';
function App() {
  return (
  <>
  <Navbar/>
  <NewTestButton/>
  <Routes>
    <Route path="/testcreation" element={<TestCreation />} />
    <Route path="/testcreation" element={<TestCreation />} />
  </Routes>
  </>
  )
}

export default App
