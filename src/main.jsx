import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RecipeBook from "./RecipeBook.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RecipeBook />
  </StrictMode>
);
