"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { fetchMovies } from "@/redux/features/movieSlice";
import PageLayout from "./PageLayout";
import SessionLoading from "./SessionLoading";
import { signOut } from "@/redux/features/userSlice";
import { EmptyState } from "./EmptyState";

export default function MovieList() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { movies, currentPage, totalPages, status, error } = useSelector(
    (state) => state.movies
  );

  useEffect(() => {
    const page = Number(searchParams.get("page")) || 1;
    dispatch(fetchMovies({ page, limit: 8 }));
  }, [dispatch, searchParams]);

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    router.push(`/?${params.toString()}`);
  };

  if (status === "loading") {
    return <div><SessionLoading/></div>;
	}
	
	  if (movies.length === 0 && currentPage === 1) {
      return <EmptyState />;
    }

  if (status === "failed") {
    return <div>Error: {error}</div>;
  }

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (totalPages - start < maxButtons - 1) {
      start = Math.max(1, totalPages - maxButtons + 1);
    }

    if (currentPage > 1) {
      buttons.push(
        <button
          key="prev"
          onClick={() => handlePageChange(currentPage - 1)}
          className="px-4 py-2 rounded-md text-white hover:bg-teal-800/50"
        >
          Previous
        </button>
      );
    }

    if (start > 1) {
      buttons.push(
        <button
          key="1"
          onClick={() => handlePageChange(1)}
          className="px-4 py-2 rounded-md text-white hover:bg-teal-800/50"
        >
          1
        </button>
      );
      if (start > 2) {
        buttons.push(
          <span key="ellipsis1" className="text-white px-2">
            ...
          </span>
        );
      }
    }

    for (let i = start; i <= end; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-4 py-2 rounded-md ${
            currentPage === i
              ? "bg-emerald-400 text-white"
              : "text-white hover:bg-teal-800/50"
          }`}
        >
          {i}
        </button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        buttons.push(
          <span key="ellipsis2" className="text-white px-2">
            ...
          </span>
        );
      }
      buttons.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="px-4 py-2 rounded-md text-white hover:bg-teal-800/50"
        >
          {totalPages}
        </button>
      );
    }

    if (currentPage < totalPages) {
      buttons.push(
        <button
          key="next"
          onClick={() => handlePageChange(currentPage + 1)}
          className="px-4 py-2 rounded-md text-white hover:bg-teal-800/50"
        >
          Next
        </button>
      );
    }

    return buttons;
	};
	

 const handleLogout = async () => {
   try {
     await dispatch(signOut()).unwrap();
     router.push("/signin");
   } catch (error) {
     console.error("Failed to logout:", error);
   }
 };

  return (
    <PageLayout
      title="My movies"
      showAddButton={true}
      showLogout={true}
      onLogout={handleLogout}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-20 ">
        {movies.map((movie) => (
          <Link
            key={movie.id}
            href={`/edit/${movie.id}`}
            className="bg-[#092C39] rounded-lg overflow-hidden group hover:ring-2 hover:ring-emerald-400 transition-all"
          >
            <div className="aspect-[3/4] relative">
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="w-full h-full object-fit"
              />
            </div>
            <div className="p-4">
              <h2 className="text-white font-semibold">{movie.title}</h2>
              <p className="text-gray-400">{movie.publishing_year}</p>
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className=" flex justify-center space-x-4 py-40">
          {renderPaginationButtons()}
        </div>
      )}
    </PageLayout>
  );
}
