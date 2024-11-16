import { useState, useEffect, useMemo, useContext } from "react";
import MyBooksModal from "./components/MyBooksModal";
import { MyLibraryContext } from "./App";

export default function TestCreation() {
  const [openMyBooksModal, setOpenMyBooksModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(3);
  const [error, setError] = useState({});
  const [previewError, setPreviewError] = useState("");
  const [includedArticles, setIncludedArticles] = useState([]);
  const [articles, setArticles] = useState([]);
  const { myLibrary } = useContext(MyLibraryContext);

  const articleExists = (articleList, articleIndex) => {
    const match = articleList.find((article) => article.index === articleIndex);
    return match;
  };

  useEffect(() => {
    setArticles((prev) => {
      let newArticles = [];
      includedArticles.forEach((articleIndex) => {
        const exists = articleExists(prev, articleIndex);
        if (exists !== undefined) {
          newArticles.push({ ...exists });
        } else {
          const [type, id] = articleIndex.split("-");
          let title = "";
          if (type === "book") {
            title = myLibrary.find((book) => book.id === id).title;
          } else if (type === "chapter") {
            myLibrary.forEach((book) => {
              const chapter = book.chapters?.find((ch) => ch.id === id);
              if (chapter) title = chapter.title;
            });
          } else if (type === "subchapter") {
            myLibrary.forEach((book) => {
              book.chapters?.forEach((chapter) => {
                const subchapter = chapter.subchapters?.find((sub) => sub.id === id);
                if (subchapter) title = subchapter.title;
              });
            });
          }
          newArticles.push({
            title,
            distribution: 0,
            amount: 0,
            auto: true,
            difficulty: ["1"],
            index: articleIndex,
          });
        }
      });
      return newArticles;
    });
  }, [includedArticles]);

  useEffect(() => {
    setArticles((prev) =>
      prev.map((article) => ({
        ...article,
        amount: Math.floor((article.distribution * totalQuestions) / 100),
      }))
    );
  }, [totalQuestions]);

  const autoDistributionValue = useMemo(() => {
    let nonManualDistribution = 0;
    let autoArticlesCount = 0;

    articles.forEach((article) => {
      if (!article.auto) {
        nonManualDistribution += article.distribution;
      } else {
        autoArticlesCount++;
      }
    });

    return Math.floor((100 - nonManualDistribution) / autoArticlesCount) || 0;
  }, [articles]);

  const handleArticleClick = (index) => {
    setSelectedArticle(selectedArticle === index ? null : index);
  };

  const handleToggleAuto = (index) => {
    const newArticles = [...articles];
    newArticles[index].auto = !newArticles[index].auto;
    setArticles(newArticles);

    if (newArticles[index].auto) {
      const autoUpdatedDistribution = calculateAutoDistribution();
      setArticles(autoUpdatedDistribution);
    }
  };

  const calculateAutoDistribution = () => {
    let nonManualDistribution = 0;
    let autoArticles = [];

    articles.forEach((article, i) => {
      if (!article.auto) {
        nonManualDistribution += article.distribution;
      } else {
        autoArticles.push(i);
      }
    });

    const newDistributionValue = Math.floor((100 - nonManualDistribution) / autoArticles.length) || 0;
    const newArticles = [...articles];
    autoArticles.forEach((i) => {
      newArticles[i].distribution = newDistributionValue;
    });

    return newArticles;
  };

  const handleDistributionChange = (index, value) => {
    if (isNaN(value)) value = 0;

    const newArticles = [...articles];
    newArticles[index].distribution = value;
    const totalDistribution = newArticles.reduce((acc, article) => {
      if (!article.auto) {
        return acc + article.distribution;
      }
      return acc;
    }, 0);

    if (totalDistribution > 100) {
      setError({ ...error, [index]: "Total distribution cannot exceed 100%" });
    } else {
      const autoUpdatedDistribution = calculateAutoDistribution();
      setArticles(autoUpdatedDistribution);
      setError({ ...error, [index]: "" });
    }
  };

  const handleDifficultyChange = (index, difficulty) => {
    const updatedArticles = [...articles];
    if (updatedArticles[index].difficulty.includes(difficulty)) {
      if (updatedArticles[index].difficulty.length > 1) {
        updatedArticles[index].difficulty = updatedArticles[index].difficulty.filter((d) => d !== difficulty);
      }
    } else {
      updatedArticles[index].difficulty.push(difficulty);
    }
    setArticles(updatedArticles);
  };

  const handleTotalQuestionsChange = (e) => {
    let value = parseInt(e.target.value);
    setTotalQuestions(value);
    if (value >= articles.length) {
      setError({ ...error, totalQuestions: "" });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (totalQuestions < articles.length) {
      setError({ ...error, totalQuestions: "Too few questions" });
    } else {
      console.log("Form submitted successfully");
    }
  };

  
  return (
    <div className="w-full h-screen flex justify-center items-center grow">
      <MyBooksModal
        open={openMyBooksModal}
        onClose={() => {
          setOpenMyBooksModal(false);
          setSearchQuery("");
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        includedArticles={includedArticles}
        setIncludedArticles={setIncludedArticles}
      />
      <div className="card w-[45%] lg:card-side bg-white shadow-xl mx-6 h-[80vh] mt-12 min-w-[500px]">
        <form className="card-body gap-0 p-[1rem] flex flex-col" onSubmit={handleSubmit}>
          <div className="w-auto flex justify-center border-b-4 border-lightgray rounded mb-0">
            <input
              type="text"
              placeholder="Test Name"
              className="input input-ghost w-full max-w-xs text-center text-3xl bg-transparent text-[#9ca3af] focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex w-[100%] h-[100%] flex-col overflow-auto scrollbar-thin">
            {articles.length === 0 && (
              <div className="w-[100%] h-[100%] flex justify-center items-center">
                <h1 className="text-gray/50 text-2xl font-bold">Select a Book or a Chapter to get started.</h1>
              </div>
            )}
            {articles.map((article, index) => (
              <div key={index} className="w-full">
                <div className="cursor-pointer p-4 border-b flex justify-between" onClick={() => handleArticleClick(index)}>
                  <span>{article.title}</span>
                  <span className="text-sm text-gray-400">
                    {article.auto ? autoDistributionValue : article.distribution}% ({article.amount})
                  </span>
                </div>
                {selectedArticle === index && (
                  <div className="p-4 border-b bg-gray-100">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Distribution of Questions (%)</label>
                      <div className="flex items-center space-x-[10px]">
                        <input
                          disabled={article.auto}
                          type="number"
                          min={0}
                          max={
                            100 -
                            articles.reduce((acc, art) => acc + (art.auto ? 0 : art.distribution), 0) +
                            (article.distribution || 0)
                          }
                          value={article.auto ? autoDistributionValue : article.distribution || ""}
                          onChange={(e) => handleDistributionChange(index, parseInt(e.target.value))}
                          className="input input-bordered w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <label className="inline-flex justify-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary"
                            checked={article.auto}
                            onChange={() => handleToggleAuto(index)}
                          />
                          <span className="ml-2">Auto</span>
                        </label>
                      </div>
                      {error[index] && <div className="text-[red] text-sm ml-2">{error[index]}</div>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Difficulty Level (Choose 1 or more)</label>
                      <div className="flex flex-col">
                        {["1", "2", "3"].map((level) => (
                          <label key={level} className="inline-flex items-center mt-2">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary"
                              value={level}
                              checked={article.difficulty.includes(level)}
                              onChange={() => handleDifficultyChange(index, level)}
                            />
                            <span className="ml-2">{level}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center border-t-4 border-lightgray rounded mt-auto pt-[10px]">
            <div className="card-actions justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpenMyBooksModal(true);
                }}
                className="btn btn-primary"
              >
                + Add Books
              </button>
            </div>
            {error.totalQuestions && <div className="text-[red] text-lg font-bold pl-4">{error.totalQuestions}</div>}
            <div className="flex items-center">
              <input
                type="number"
                placeholder="Total Qs"
                value={totalQuestions}
                onChange={handleTotalQuestionsChange}
                className="input input-bordered w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button type="submit" className="btn btn-primary ml-2">
                Create
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card w-[45%] lg:card-side bg-white shadow-xl mx-6 h-[80vh] mt-12">
        <div className="card-body gap-0 p-[1rem] min-w-[500px]">
          <div className="w-auto flex justify-center border-b-4 border-lightgray rounded pb-[12px] mb-0">
            <h1 className="text-3xl text-[#9ca3af] text-center">Preview</h1>
          </div>
          <div className="flex w-[100%] h-[100%] divide-x-4 divide-lightgray space-x-[1%]">
            {articles.length === 0 ? (
                <div className="w-[100%] h-[100%] flex justify-center items-center">
                  <h1 className="text-gray/50 text-2xl font-bold">No book or article selected</h1>
                </div>
            ) : (
              <>
              {previewError.length > 0 ? (<div className="w-[100%] h-[100%] flex justify-center items-center">
                <h1 className="text-[red]/50 text-2xl font-bold">{previewError}</h1>
              </div>) : (<>
                
              </>)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}