export async function scrapeWithFirecrawl(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const md = data?.data?.markdown ?? data?.markdown ?? "";
  if (!md) throw new Error("Firecrawl returned no content for this URL.");
  return md.slice(0, 18000);
}