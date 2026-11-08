export type NewsSource = {
  id: string;
  name: string;
  region: "us" | "iran" | "gulf" | "wire";
  url: string;
};

/**
 * Curated RSS feeds focused on US / Iran / Gulf (Dubai·UAE) geopolitics.
 * Prefer official / wire / regional outlets that expose stable RSS.
 */
export const SOURCES: NewsSource[] = [
  // —— Wire / Western ——
  {
    id: "bbc-world",
    name: "BBC World",
    region: "wire",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera EN",
    region: "wire",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    id: "guardian-world",
    name: "The Guardian World",
    region: "wire",
    url: "https://www.theguardian.com/world/rss",
  },
  {
    id: "reuters-google",
    name: "Reuters via Google News",
    region: "wire",
    url: "https://news.google.com/rss/search?q=site:reuters.com+(Iran+OR+Iranian+OR+Tehran+OR+IRGC+OR+Dubai+OR+UAE)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "ap-google",
    name: "AP via Google News",
    region: "wire",
    url: "https://news.google.com/rss/search?q=site:apnews.com+(Iran+OR+Iranian+OR+Tehran+OR+Persian+Gulf)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },

  // —— US ——
  {
    id: "state-dept",
    name: "US State Dept Press",
    region: "us",
    url: "https://www.state.gov/rss-feed/press-releases/feed/",
  },
  {
    id: "whitehouse",
    name: "White House",
    region: "us",
    url: "https://www.whitehouse.gov/news/feed/",
  },
  {
    id: "pentagon",
    name: "US DoD News",
    region: "us",
    url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?max=20&ContentType=1&Site=945",
  },
  {
    id: "google-us-iran",
    name: "Google News US-Iran",
    region: "us",
    url: "https://news.google.com/rss/search?q=(Iran+OR+IRGC)+AND+(US+OR+Pentagon+OR+%22White+House%22+OR+strike+OR+war+OR+missile)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },

  // —— Iran ——
  {
    id: "presstv",
    name: "Press TV",
    region: "iran",
    url: "https://www.presstv.ir/rss.xml",
  },
  {
    id: "tehrantimes",
    name: "Tehran Times",
    region: "iran",
    url: "https://www.tehrantimes.com/rss",
  },
  {
    id: "google-iran",
    name: "Google News Iran",
    region: "iran",
    url: "https://news.google.com/rss/search?q=Iran+(missile+OR+strike+OR+IRGC+OR+nuclear+OR+war+OR+US)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },

  // —— Gulf / Dubai / UAE ——
  {
    id: "wam-google",
    name: "WAM / UAE via Google",
    region: "gulf",
    url: "https://news.google.com/rss/search?q=(Dubai+OR+UAE+OR+%22Abu+Dhabi%22)+(Iran+OR+war+OR+strike+OR+missile+OR+evacuation+OR+security)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "gulfnews-google",
    name: "Gulf News via Google",
    region: "gulf",
    url: "https://news.google.com/rss/search?q=site:gulfnews.com+(Iran+OR+war+OR+strike+OR+missile)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
];
