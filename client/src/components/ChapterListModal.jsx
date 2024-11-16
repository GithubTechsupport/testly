import { useState, useEffect, useContext } from 'react';
import { MyLibraryContext } from '../App';

export default function ChapterListModal({ open, onClose, bookID, searchQuery, setSearchQuery, selectedBooks, setSelectedBooks }) {
  const [chapters, setChapters] = useState([]);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [tempSelectedBooks, setTempSelectedBooks] = useState([]);
  const { myLibrary } = useContext(MyLibraryContext);

  useEffect(() => {
    if (bookID !== null) {
      const book = myLibrary.find((book) => book.id === bookID);
      if (book) {
        setChapters(book.chapters || []);
      }
    }
  }, [bookID, myLibrary]);

  useEffect(() => {
    setTempSelectedBooks(selectedBooks);
  }, [selectedBooks]);

  const handleToggleChapter = (chapterID) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterID]: !prev[chapterID],
    }));
  };

  const handleToggleArticle = (index) => {
    setTempSelectedBooks((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  const handleSubmit = () => {
    setSelectedBooks(tempSelectedBooks);
    onClose();
  };

  const handleClose = () => {
    setTempSelectedBooks(selectedBooks);
    onClose();
  };

  return (
    <div className={`fixed inset-0 flex justify-center items-center transition-colors ${open ? "visible bg-black/20 z-20" : "invisible"}`}>
      <div onClick={(e) => e.stopPropagation()} className={`card lg:card-side shadow-xl w-[20%] min-w-[300px] h-[80%] bg-[#f8fafc] rounded-xl p-6 transition-all ${open ? "scale-100 opacity-100" : "scale-125 opacity-0"}`}>
        <button onClick={handleClose} className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600">
          X
        </button>
        <div className="card-body gap-0 p-[0rem]">
          <div className="w-auto flex justify-center border-b-4 border-[#9ca3af]/20 rounded pb-[12px]">
            <input
              type="text"
              placeholder="SEARCH"
              onChange={(e) => setSearchQuery(e.target.value)}
              value={searchQuery}
              className="input input-ghost w-full max-w-xs text-center text-3xl bg-transparent text-[#9ca3af] focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex flex-col w-[100%] h-[100%] overflow-auto p-1">
            {chapters
              .filter((chapter) => chapter.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((chapter) => (
                <div key={chapter.id} className="p-2 border-b cursor-pointer hover:bg-gray-100">
                  <div className="flex justify-between items-center" onClick={() => handleToggleChapter(chapter.id)}>
                    <span>{chapter.title}</span>
                    <input
                      type="checkbox"
                      readOnly={true}
                      checked={tempSelectedBooks.includes(`chapter-${chapter.id}`)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleArticle(`chapter-${chapter.id}`);
                      }}
                      className="checkbox checkbox-primary"
                    />
                  </div>
                  {expandedChapters[chapter.id] && (
                    <div className="pl-4">
                      {chapter.subchapters?.map((subchapter) => (
                        <div key={subchapter.id} className="flex justify-between items-center p-2 border-b cursor-pointer hover:bg-gray-100">
                          <span>{subchapter.title}</span>
                          <input
                            type="checkbox"
                            readOnly={true}
                            checked={tempSelectedBooks.includes(`subchapter-${subchapter.id}`)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleArticle(`subchapter-${subchapter.id}`);
                            }}
                            className="checkbox checkbox-primary"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
          <div className="card-actions justify-end pt-[10px]">
            <button onClick={handleSubmit} className="btn btn-primary">
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}