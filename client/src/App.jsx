import { useState, useEffect, createContext } from 'react';
import Navbar from "./components/Navbar";
import NewTestButton from "./components/NewTestButton";
import TestCreation from './TestCreation';
import { Routes, Route, useLocation, } from 'react-router-dom';
import Homepage from './Homepage';

export const MyLibraryContext = createContext();

function App() {
  const [myLibrary, setMyLibrary] = useState([
    {id: "19204", title: "Maths", chapters: 
      [{id:"49912", title: "Derivation", subchapters: [{id:"839120",title: "Newtons Method"}, {id:"849120",title: "Core Rule"}]}, {id:"587129",title: "Integrals", subchapters: [{id:"4891930",title: "Integration by Substituion"}]}]
    },
    {id: "940192", title: "Complex Theory", chapters:
      [{id:"192049",title: "Complex Chapter 1"}, {id:"471892",title: "Complex Chapter 2"}]
    },
    {id: "291049", title: "Marketing"},
  ]);
  const [showNewTest, setShowNewTest] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname == '/TestCreation') {
      setShowNewTest(false);
    } else {setShowNewTest(true)}
    console.log(location.pathname);
  }, [location.pathname]);

  return (
  <div className="flex h-full flex-col bg-[#e2e8f0] overflow-auto">
  <MyLibraryContext.Provider value={{myLibrary, setMyLibrary}}>
  <Navbar/>
  {showNewTest ? (<NewTestButton/>) : (<></>)}
  <Routes>
    <Route path="/testcreation" element={<TestCreation />} />
    <Route path="/home" element={<Homepage />} />
  </Routes>
  </MyLibraryContext.Provider>
  </div>
  );
}

export default App;
