import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";

const getSignedUrl = async (path) => {
  if (!path) return null;

  const fileName = path.includes("/") ? path.split("/").pop() : path;

  const { data, error } = await supabase.storage
    .from("movie_posters")
    .createSignedUrl(fileName, 604800); // 7 days

  if (error) throw error;
  return data.signedUrl;
};

export const fetchMovies = createAsyncThunk(
  "movies/fetchMovies",
  async ({ page = 1, limit = 8 }) => {
    try {
      const offset = (page - 1) * limit;

      const { count } = await supabase
        .from("movies")
        .select("*", { count: "exact", head: true });

      const { data: movies, error: fetchError } = await supabase
        .from("movies")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (fetchError) throw fetchError;

      const moviesWithSignedUrls = await Promise.all(
        movies.map(async (movie) => {
          if (movie.poster_url) {
            try {
              const signedUrl = await getSignedUrl(movie.poster_url);
              return { ...movie, poster_url: signedUrl };
            } catch (error) {
              console.error(
                `Failed to get signed URL for movie ${movie.id}:`,
                error
              );
              return movie;
            }
          }
          return movie;
        })
      );

      return {
        movies: moviesWithSignedUrls,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error("Failed to fetch movies:", error);
      throw error;
    }
  }
);

export const addMovie = createAsyncThunk(
  "movies/addMovie",
  async (formData) => {
    try {
      let poster_url = null;
      const file = formData.get("poster");

      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("movie_posters")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get signed URL for poster
        poster_url = await getSignedUrl(fileName);
      }

      const { data: movie, error: insertError } = await supabase
        .from("movies")
        .insert({
          title: formData.get("title"),
          publishing_year: parseInt(formData.get("publishing_year")),
          poster_url,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return movie;
    } catch (error) {
      console.error("Failed to create movie:", error);
      throw error;
    }
  }
);

export const updateMovie = createAsyncThunk(
  "movies/updateMovie",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      let poster_url = null;

      const file = formData.get("poster");
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("movie_posters")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        poster_url = await getSignedUrl(fileName);
      }

      const { data: movie, error: updateError } = await supabase
        .from("movies")
        .update({
          title: formData.get("title"),
          publishing_year: parseInt(formData.get("publishing_year")),
          ...(poster_url && { poster_url }),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;
      return movie;
    } catch (error) {
      console.error("Failed to update movie:", error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchMovie = createAsyncThunk("movies/fetchMovie", async (id) => {
  try {
    const { data: movie, error: fetchError } = await supabase
      .from("movies")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    if (!movie) {
      throw new Error("Movie not found");
    }

    if (movie.poster_url) {
      try {
        const fileName = movie.poster_url.includes("/")
          ? movie.poster_url.split("/").pop()
          : movie.poster_url;

        const { data, error } = await supabase.storage
          .from("movie_posters")
          .createSignedUrl(fileName, 604800); // 7 days expiry

        if (!error) {
          movie.poster_url = data.signedUrl;
        }
      } catch (error) {
        console.error(`Failed to get signed URL for movie ${id}:`, error);
      }
    }

    return movie;
  } catch (error) {
    console.error("Failed to fetch movie:", error);
    throw error;
  }
});

const movieSlice = createSlice({
  name: "movies",
  initialState: {
    movies: [],
    currentMovie: null,
    status: "idle",
    error: null,
    currentPage: 1,
    totalPages: 1,
  },
  reducers: {
    clearMovies: (state) => {
      state.movies = [];
      state.currentMovie = null;
      state.currentPage = 1;
      state.totalPages = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMovies.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMovies.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.movies = action.payload.movies;
        state.currentPage = action.payload.currentPage;
        state.totalPages = action.payload.totalPages;
        state.error = null;
      })
      .addCase(fetchMovies.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })
      .addCase(fetchMovie.pending, (state) => {
        state.status = "loading";
        state.currentMovie = null;
        state.error = null;
      })
      .addCase(fetchMovie.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentMovie = action.payload;
        state.error = null;
      })
      .addCase(fetchMovie.rejected, (state, action) => {
        state.status = "failed";
        state.currentMovie = null;
        state.error = action.error.message;
      })
      .addCase(addMovie.fulfilled, (state, action) => {
        state.movies.unshift(action.payload);
      })
      .addCase(updateMovie.fulfilled, (state, action) => {
        const index = state.movies.findIndex(
          (movie) => movie.id === action.payload.id
        );
        if (index !== -1) {
          state.movies[index] = action.payload;
        }
        state.currentMovie = action.payload;
      });
  },
});

export const { clearMovies } = movieSlice.actions;
export default movieSlice.reducer;
