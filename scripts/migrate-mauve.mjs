import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:tsx|ts|css)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const files = sourceFiles("client/src");
const approved = new Set(["#FDF3F3", "#F8E7E7", "#A070A1", "#724060"]);

const replacements = new Map([
  ["#1f2024", "#724060"], ["#33343a", "#724060"], ["#34353b", "#724060"],
  ["#4c4d52", "#724060"], ["#4f46e5", "#724060"], ["#54555a", "#724060"],
  ["#57585d", "#724060"], ["#575860", "#724060"], ["#65666b", "#724060"],
  ["#66676d", "#724060"], ["#6f7080", "#724060"], ["#717278", "#724060"],
  ["#74756f", "#724060"], ["#74757b", "#724060"], ["#75767c", "#724060"],
  ["#76777c", "#724060"], ["#77787e", "#724060"], ["#7c7d83", "#724060"],
  ["#7d7e84", "#724060"], ["#7e7f84", "#724060"], ["#7f8085", "#724060"],
  ["#7f8087", "#724060"], ["#808187", "#724060"], ["#818287", "#724060"],
  ["#84858a", "#724060"], ["#85868b", "#724060"], ["#85868c", "#724060"],
  ["#888990", "#724060"], ["#898a90", "#724060"], ["#8a8b90", "#724060"],
  ["#8a8b91", "#724060"], ["#8b8c92", "#724060"], ["#8c8d92", "#724060"],
  ["#8e8f95", "#724060"], ["#929399", "#724060"], ["#939499", "#724060"],
  ["#94959a", "#724060"], ["#96979c", "#724060"], ["#96979d", "#724060"],
  ["#98999e", "#724060"], ["#9b9ca1", "#724060"], ["#bbbcc1", "#724060"],
  ["#c6c7cd", "#724060"],
  ["#254ddd", "#A070A1"], ["#2e5bff", "#A070A1"], ["#3854c8", "#A070A1"],
  ["#425fd2", "#A070A1"], ["#465dcc", "#A070A1"], ["#4966db", "#A070A1"],
  ["#4b63d1", "#A070A1"], ["#4c67de", "#A070A1"], ["#4d66cf", "#A070A1"],
  ["#5068ce", "#A070A1"], ["#5268cb", "#A070A1"], ["#526cdf", "#A070A1"],
  ["#536de0", "#A070A1"], ["#5c72d8", "#A070A1"], ["#5d74dd", "#A070A1"],
  ["#5e73d9", "#A070A1"], ["#667bdb", "#A070A1"], ["#6680f1", "#A070A1"],
  ["#687edc", "#A070A1"], ["#6d82df", "#A070A1"], ["#7a8efa", "#A070A1"],
  ["#96a8f4", "#A070A1"], ["#aab9f6", "#A070A1"], ["#a266ba", "#A070A1"],
  ["#a35b56", "#A070A1"], ["#b13c36", "#A070A1"], ["#b4b7c9", "#A070A1"],
  ["#bc5b46", "#A070A1"], ["#c53b37", "#A070A1"], ["#157652", "#A070A1"],
  ["#159166", "#A070A1"], ["#9d5753", "#A070A1"],
  ["#d9d9df", "#A070A1"], ["#dfe4ff", "#A070A1"],
  ["#e3e7fa", "#F8E7E7"], ["#edf0ff", "#F8E7E7"], ["#edfdf6", "#F8E7E7"],
  ["#eef0fa", "#F8E7E7"], ["#f1f3fc", "#F8E7E7"], ["#f3f3f1", "#F8E7E7"],
  ["#f4f4f2", "#F8E7E7"], ["#f4f6ff", "#F8E7E7"], ["#f7f7f5", "#F8E7E7"],
  ["#f7f8fc", "#F8E7E7"], ["#f8f8f6", "#F8E7E7"], ["#f9f9f8", "#F8E7E7"],
  ["#fafaf8", "#F8E7E7"], ["#fbfbfa", "#F8E7E7"], ["#fff0ef", "#F8E7E7"],
  ["#fff3ef", "#F8E7E7"], ["#fff3f2", "#F8E7E7"], ["#fff4f3", "#F8E7E7"],
]);

function semanticMauve(hex) {
  const normalized = hex.length === 4
    ? `#${hex.slice(1).split("").map(character => character + character).join("")}`
    : hex;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  if (luminance > 0.94) return "#FDF3F3";
  if (luminance > 0.70) return "#F8E7E7";
  if (luminance > 0.38) return "#A070A1";
  return "#724060";
}

for (const file of files) {
  let source = readFileSync(file, "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  source = source.replace(/#[0-9a-fA-F]{3,8}\b/g, value => {
    const upper = value.toUpperCase();
    return approved.has(upper) ? upper : semanticMauve(value);
  });
  source = source
    .replaceAll("bg-white", "bg-[#FDF3F3]")
    .replaceAll("text-white", "text-[#FDF3F3]")
    .replaceAll("border-black/[.06]", "border-[#A070A1]")
    .replaceAll("border-black/[.1]", "border-[#A070A1]")
    .replaceAll("divide-black/[.06]", "divide-[#A070A1]")
    .replaceAll("text-black", "text-[#724060]");
  writeFileSync(file, source);
}
