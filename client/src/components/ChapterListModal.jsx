export default function ChapterListModal({ open, onClose, bookID, searchQuery, setSearchQuery }) {

  return (
    <div className={`
      fixed inset-0 flex justify-center items-center transition-colors ${open ? "visible bg-black/20 z-20" : "invisible"}  
    `}>
      <div onClick={(e) => {e.stopPropagation()}} className={`card lg:card-side shadow-xl w-[20%] min-w-[300px] h-[80%] bg-[#f8fafc] rounded-xl p-6 transition-all ${open ? "scale-100 opacity-100" : "scale-125 opacity-0"}`}>
        <button onClick={onClose} className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600">
          X
        </button>
        <div className="card-body gap-0 p-[0rem]">
          <div className="w-auto flex justify-center border-b-4 border-[#9ca3af]/20 rounded pb-[12px]">
            <input type="text" placeholder="SEARCH" onChange={(e) => {setSearchQuery(e.target.value)}} value={searchQuery} className="input input-ghost w-full max-w-xs text-center text-xl bg-transparent text-[#9ca3af] focus:outline-none focus:ring-0" />
          </div>
        <div className="flex flex-wrap flex-col w-[100%] h-[100%] overflow-auto p-1">
          <div className="w-[100%] h-[50px] border-2 rounded-l border-[#9ca3af]/20 flex justify-between items-center p-2 cursor-pointer">
          <svg className="w-2.5 h-2.5 ms-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/>
          </svg>
          <h1>Test Chapter</h1>
          <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-primary rounded-full bg-white border-black"/>
          </div>
          <div className="block">
            <div className="w-[100%] flex justify-between items-center p-2">
            <h1>Underkapittel 1</h1>
            <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-sm checkbox-primary rounded-full bg-white border-black"/>
            </div>
            <div className="w-[100%] flex justify-between items-center p-2">
            <h1>Underkapittel 1</h1>
            <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-sm checkbox-primary rounded-full bg-white border-black"/>
            </div>
            <div className="w-[100%] flex justify-between items-center p-2">
            <h1>Underkapittel 1</h1>
            <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-sm checkbox-primary rounded-full bg-white border-black"/>
            </div>
          </div>
          <div className="w-[100%] h-[50px] border-2 rounded-l border-[#9ca3af]/20 flex justify-between items-center p-2 cursor-pointer">
          <svg className="w-2.5 h-2.5 ms-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/>
          </svg>
          <h1>Test Chapter</h1>
          <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-primary rounded-full bg-white border-black"/>
          </div>
          <div className="block">
            <div className="w-[100%] flex justify-between items-center p-2">
            <h1>Underkapittel 1</h1>
            <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-sm checkbox-primary rounded-full bg-white border-black"/>
            </div>
            <div className="w-[100%] flex justify-between items-center p-2">
            <h1>Underkapittel 1</h1>
            <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-sm checkbox-primary rounded-full bg-white border-black"/>
            </div>
            <div className="w-[100%] flex justify-between items-center p-2">
            <h1>Underkapittel 1</h1>
            <input type="checkbox" onClick={() => {console.log("nice2")}} defaultValue={false} className="float-right checkbox checkbox-sm checkbox-primary rounded-full bg-white border-black"/>
            </div>
          </div>
        </div>
          <div className="card-actions justify-end pt-[10px]">
            <button onClick={onClose} className="btn btn-primary btn-sm">Submit</button>
          </div>
        </div>
      </div>
    </div>

  )
}