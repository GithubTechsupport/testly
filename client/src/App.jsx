import { useState, useEffect } from 'react';
import Navbar from "./components/Navbar";
import NewTestButton from "./components/NewTestButton";
import TestCreation from './TestCreation';
import { Routes, Route, useLocation, } from 'react-router-dom';
import Homepage from './Homepage';

function App() {
  const [showNewTest, setShowNewTest] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname == '/TestCreation') {
      setShowNewTest(false)
    } else {setShowNewTest(true)}
    console.log(location.pathname);
  }, [location.pathname]);

  return (
  <>
  <Navbar/>
  {showNewTest ? (<NewTestButton/>) : (<>TEST</>)}
  <Routes>
    <Route path="/testcreation" element={<TestCreation />} />
    <Route path="/home" element={<Homepage />} />
  </Routes>
  </>
  )
}

export default App
