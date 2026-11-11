import { GoogleBooksError } from "../lib/googleBooks";

export function catalogErrorMessage(error: unknown) {
  if (error instanceof GoogleBooksError && (error.status === 429 || error.status === 403)) {
    return "Google Books is limiting requests right now. Try again in a minute, or fill in the details yourself.";
  }
  if (error instanceof GoogleBooksError && error.status === 0) {
    return "Couldn't reach Google Books. Check your connection, or fill in the details yourself.";
  }
  return "Google Books didn't answer. Try again, or fill in the details yourself.";
}
