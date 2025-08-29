const fs = require("fs");
const https = require("https");
const http = require("http");
const readline = require("readline");

// Hàm tải HTML
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

// Hàm tạo timestamp
function getTimestamp() {
  const d = new Date();
  return d.toISOString().replace(/[:T]/g, "-").split(".")[0];
}

async function scrapeWebsite(url) {
  try {
    // Nếu không có http/https thì mặc định thêm https://
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    const html = await fetchHTML(url);

    const result = {
      rawHTML: html,
      headings: [],
      paragraphs: [],
      links: [],
      images: [],
      scripts: [],
      metaTags: [],
      urls: [],
    };

    // Headings
    result.headings = [...html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi)].map(
      (m) => `- ${m[1].replace(/\s+/g, " ").trim()}`
    );

    // Paragraphs
    result.paragraphs = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)].map(
      (m, i) => `- [p-${i}] ${m[1].replace(/\s+/g, " ").trim()}`
    );

    // Links
    result.links = [
      ...html.matchAll(
        /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi
      ),
    ].map((m, i) => {
      result.urls.push(m[1]);
      return `- [link-${i}] href="${m[1]}" text="${m[2]
        .replace(/\s+/g, " ")
        .trim()}"`;
    });

    // Images
    result.images = [
      ...html.matchAll(
        /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']?([^"']*)["']?/gi
      ),
    ].map((m, i) => {
      result.urls.push(m[1]);
      return `- [img-${i}] src="${m[1]}" alt="${m[2] || "none"}"`;
    });

    // Scripts
    result.scripts = [
      ...html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi),
    ].map((m, i) => {
      result.urls.push(m[1]);
      return `- [script-${i}] src="${m[1]}"`;
    });

    // Meta tags
    result.metaTags = [
      ...html.matchAll(
        /<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi
      ),
    ].map((m, i) => `- [meta-${i}] name="${m[1]}" content="${m[2]}"`);

    result.urls = [...new Set(result.urls)].map((u) => `- ${u}`);

    return result;
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    return { error: err.message };
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9.-]/gi, "-"); // thay ký tự lạ bằng "-"
}

function extractUrlPart(url) {
  try {
    // Nếu thiếu http/https thì thêm vào mặc định https://
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    const u = new URL(url);
    // Ghép domain + path (bỏ dấu / ở đầu)
    let part = u.hostname + (u.pathname !== "/" ? u.pathname : "");
    return sanitizeFilename(part);
  } catch (e) {
    return "unknown-url";
  }
}

async function run() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("🌐 Nhập URL để scrape: ", async (url) => {
    rl.close();

    if (!url) {
      console.log("⚠️ Bạn chưa nhập URL!");
      return;
    }

    const data = await scrapeWebsite(url);
    if (data.error) return;

    let output = "=== SCRAPED DATA ===\n\n";
    output +=
      ">> RAW HTML (truncated):\n" +
      data.rawHTML.substring(0, 500) +
      "... [TRUNCATED]\n\n";
    output +=
      ">> HEADINGS:\n" + (data.headings.join("\n") || "- none") + "\n\n";
    output +=
      ">> PARAGRAPHS:\n" + (data.paragraphs.join("\n") || "- none") + "\n\n";
    output +=
      ">> LINKS:\n" + (data.links.join("\n") || "- none") + "\n\n";
    output +=
      ">> IMAGES:\n" + (data.images.join("\n") || "- none") + "\n\n";
    output +=
      ">> SCRIPTS:\n" + (data.scripts.join("\n") || "- none") + "\n\n";
    output +=
      ">> META TAGS:\n" + (data.metaTags.join("\n") || "- none") + "\n\n";
    output +=
      ">> URLS (Unique):\n" + (data.urls.join("\n") || "- none") + "\n\n";

    const folder = "./output";
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    const urlPart = extractUrlPart(url);
    const filename = `${folder}/${urlPart}-${getTimestamp()}.txt`;
    fs.writeFileSync(filename, output, "utf-8");
    console.log(`✅ Đã lưu dữ liệu vào ${filename}`);
  });
}

run();
