export function extractVote(text: string, maxOption = 5): number | null {
  // Find a digit 1..maxOption in the text
  const match = text.match(new RegExp(`\\b([1-${maxOption}])\\b`));
  if (!match) return null;
  return parseInt(match[1], 10);
}
