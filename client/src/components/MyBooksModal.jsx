import { useEffect, useRef, useState, useContext } from 'react';
import complex_analysis_book_cover from '../example_covers/complex_analysis_book_cover.jpg';
import ChapterListModal from './ChapterListModal';
import { MyLibraryContext } from '../App';

export default function MyBooksModal({ open, onClose, searchQuery, setSearchQuery, includedArticles, setIncludedArticles }) {
  const cover1 = useRef(complex_analysis_book_cover);
  const [openChapterListModal, setOpenChapterListModal] = useState(false);
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const { myLibrary } = useContext(MyLibraryContext);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [currentBook, setCurrentBook] = useState(null);

  const exit = () => {
    setSelectedBooks(includedArticles);
    onClose();
  };

  const submit = () => {
    setIncludedArticles(selectedBooks);
    onClose();
  };

  const handleToggleBook = (index) => {
    setSelectedBooks((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  const handleOpenChapterList = (index) => {
    setCurrentBook(index);
  };

  const handleCloseChapterList = () => {
    setChapterSearchQuery("");
    setCurrentBook(null);
  };

  useEffect(() => {
    setOpenChapterListModal(currentBook !== null);
  }, [currentBook]);

  useEffect(() => {
    setSelectedBooks(includedArticles);
  }, [includedArticles]);

  return (
    <>
      <ChapterListModal
        open={openChapterListModal}
        onClose={handleCloseChapterList}
        bookID={currentBook}
        searchQuery={chapterSearchQuery}
        setSearchQuery={setChapterSearchQuery}
        selectedBooks={selectedBooks}
        setSelectedBooks={setSelectedBooks}
      />
      <div
        className={`fixed inset-0 flex justify-center items-center transition-colors ${
          open ? "visible bg-black/20 z-10" : "invisible"
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`card lg:card-side shadow-xl w-[90%] h-[90%] bg-[#f8fafc] rounded-xl p-6 transition-all ${
            open ? "scale-100 opacity-100" : "scale-125 opacity-0"
          }`}
        >
          <button
            onClick={exit}
            className="absolute top-2 right-2 p-1 rounded-lg text-gray bg-lightgray w-6 h-12"
          >
            X
          </button>
          <div className="card-body gap-0 p-[0rem]">
            <div className="w-auto flex justify-center border-b-4 border-[#9ca3af]/20 rounded pb-[12px]">
              <input
                onChange={(e) => setSearchQuery(e.target.value)}
                value={searchQuery}
                type="text"
                placeholder="SEARCH"
                className="input input-ghost w-full max-w-xs text-center text-3xl bg-transparent text-[#9ca3af] focus:outline-none focus:ring-0"
              />
            </div>
            <div className="flex flex-wrap w-[100%] h-[100%] overflow-auto p-1 justify-center">
              {myLibrary.map((book, index) => (
                <div key={index} className="card lg:card-side bg-white shadow-xl w-[150px] h-[220px] m-2">
                  <div className="card-body gap-0 p-0">
                    <div
                      onClick={() => handleToggleBook(`book-${book.id}`)}
                      className="cursor-pointer w-[100%] h-[175px]"
                    >
                      <div className="w-[100%] card-actions justify-end absolute">
                        <input
                          type="checkbox"
                          readOnly={true}
                          checked={selectedBooks.includes(`book-${book.id}`)}
                          className="float-right checkbox checkbox-primary rounded-none rounded-tr-xl rounded-bl-xl bg-white border-black"
                        />
                      </div>
                      <img className="size-full rounded-t-xl" src={cover1.current} />
                    </div>
                    <div className="card-actions justify-center">
                      <button
                        onClick={() => handleOpenChapterList(book.id)}
                        className="btn size-full text-gray rounded-t-none"
                      >
                        Chapters
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-actions justify-end pt-[10px]">
              <button onClick={submit} className="btn btn-primary">
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}