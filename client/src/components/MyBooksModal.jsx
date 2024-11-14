import { useRef } from 'react';
import complex_analysis_book_cover from '../example_covers/complex_analysis_book_cover.jpg';

export default function MyBooksModal({ open, onClose }) {
  const cover1 = useRef(complex_analysis_book_cover);

  return (

    <div className={`
      fixed inset-0 flex justify-center items-center transition-colors ${open ? "visible bg-black/20 z-10" : "invisible"}  
    `}>
      <div onClick={(e) => {e.stopPropagation()}} className={`card lg:card-side shadow-xl w-[90%] h-[90%] bg-[#f8fafc] rounded-xl p-6 transition-all ${open ? "scale-100 opacity-100" : "scale-125 opacity-0"}`}>
        <button onClick={onClose} className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600">
          X
        </button>
        <div className="card-body gap-0 p-[0rem]">
          <div className="w-auto flex justify-center border-b-4 border-[#9ca3af]/20 rounded pb-[12px]">
            <h1 className="text-3xl text-[#9ca3af]">My Books</h1>
          </div>
        <div className="flex flex-wrap w-[100%] h-[100%] overflow-auto p-1 justify-center">
          <div className="card lg:card-side bg-white shadow-xl w-[150px] h-[220px] m-2">
            <div className="card-body gap-0 p-0">
              <div onClick={(e) => {e.target.parentElement.firstChild.firstChild.click()}} className="cursor-pointer w-[100%] h-[175px]">
              <div className="w-[100%] card-actions justify-end absolute">
                <input type="checkbox" onClick={() => {console.log("nice")}} defaultValue={false} className="float-right checkbox checkbox-primary rounded-none rounded-tr-xl rounded-bl-xl bg-white border-black"/>
              </div>
              <img className="size-full rounded-t-xl" src={cover1.current}/>
              </div>
              <div className="card-actions justify-center">
                <button onClick={() => {}} className="btn size-full text-gray rounded-t-none">Chapters</button>
              </div>
            </div>
          </div>
        </div>
          <div className="card-actions justify-end pt-[10px]">
            <button onClick={onClose} className="btn btn-primary">Submit</button>
          </div>
        </div>
      </div>
    </div>

  )
}