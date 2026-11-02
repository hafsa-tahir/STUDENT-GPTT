import handler from "./index.js";

export default function catchAllHandler(req, res) {
  if (req && req.query && req.query.slug) {
    const slugArr = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug];
    const subpath = slugArr.join("/");
    const remainingQuery = req.url && req.url.includes("?") ? req.url.split("?")[1] : null;
    req.url = `/api/${subpath}${remainingQuery ? `?${remainingQuery}` : ""}`;
  }
  return handler(req, res);
}

