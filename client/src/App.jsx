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
      setShowNewTest(false);
    } else {setShowNewTest(true)}
    console.log(location.pathname);
  }, [location.pathname]);

  return (
  <div className="size-full flex flex-col bg-white">
  <Navbar/>
  {showNewTest ? (<NewTestButton/>) : (<></>)}
  <Routes>
    <Route path="/testcreation" element={<TestCreation />} />
    <Route path="/home" element={<Homepage />} />
  </Routes>
  </div>
  );
}

export default App;
