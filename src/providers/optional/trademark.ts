export interface TrademarkLinksResult {
  name: string;
  disclaimer: string;
  links: Array<{ registry: string; url: string }>;
}

export function buildTrademarkLinks(slug: string): TrademarkLinksResult {
  const q = encodeURIComponent(slug);
  return {
    name: slug,
    disclaimer:
      "Heuristic search links only — not legal advice. Always consult an IP attorney before filing.",
    links: [
      { registry: "USPTO", url: `https://tmsearch.uspto.gov/search/search-results?query=${q}` },
      { registry: "WIPO Global Brand DB", url: `https://branddb.wipo.int/en/quicksearch?q=${q}` },
      { registry: "EUIPO eSearch", url: `https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/${q}` },
    ],
  };
}
