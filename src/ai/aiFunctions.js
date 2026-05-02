// src/ai/aiFunctions.js
export const AI_FUNCTIONS = [
  {
    name: "getPublicMovies",
    params: [
      "keyword",
      "type",
      "year",
      "category",
      "country",
      "lifecycle_status",
      "is_premium",
      "page",
      "limit",
    ],
  },
  {
    name: "getPublicMovieById",
    params: ["id"],
  },
  {
    name: "getMovieWatch",
    params: ["slug", "ep", "server", "is_public"],
  },
  {
    name: "getCategories",
    params: [],
  },
  {
    name: "getCountries",
    params: [],
  },
  {
    name: "getUserHistory",
    params: ["limit", "page"],
  },
  {
    name: "clearAllHistory",
    params: [],
  },
];
