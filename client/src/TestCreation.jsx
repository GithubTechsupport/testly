import { useState } from "react";
import MyBooksModal from "./components/MyBooksModal";

export default function TestCreation() {

  const [openMyBooksModal, setOpenMyBooksModal] = useState(false)

  return (
  <div className="w-full h-screen flex justify-center items-center grow">
    <MyBooksModal open={openMyBooksModal} onClose={() => setOpenMyBooksModal(false)}/>
    <div className="card w-screen lg:card-side bg-white shadow-xl mx-12 h-[80vh] mt-12">
      <div className="card-body gap-0 p-[1rem]">
        <div className="w-auto flex justify-center border-b-4 border-lightgray rounded">
          <input type="text" placeholder="Test Name" className="input input-ghost w-full max-w-xs text-center text-3xl bg-transparent text-[#9ca3af] focus:outline-none focus:ring-0" />
        </div>
        <div className="flex w-[100%] h-[100%] ">
        <div className="w-[49%] h-[100%]">
          <p>Click the button to listen on Spotiwhy app.</p>
        </div>
        <div className="w-[49%] h-[100%]">
          <p className="float-right">Click the button to listen on Spotiwhy app.</p>
        </div>
        </div>
        <div className="flex justify-between border-t-4 border-lightgray rounded">
        <div className="card-actions justify-end pt-[10px]">
          <button onClick={() => {setOpenMyBooksModal(true);}} className="btn btn-primary">+ Add Books</button>
        </div>
        <div className="card-actions justify-end pt-[10px]">
          <button className="btn btn-primary">Create</button>
        </div>
        </div>
      </div>
    </div>

    <div className="card w-screen lg:card-side bg-white shadow-xl mx-12 h-[80vh] mt-12">
      <div className="card-body gap-0 p-[1rem]">
        <div className="w-auto flex justify-center border-b-4 border-lightgray rounded pb-[12px]">
          <h1 className="text-3xl text-[#9ca3af]">Preview</h1>
        </div>
        <div className="flex w-[100%] h-[100%] divide-x-4 divide-lightgray space-x-[1%]">
        </div>
      </div>
      
    </div>
  </div>

  );
}