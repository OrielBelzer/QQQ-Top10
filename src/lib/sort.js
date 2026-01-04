export function nextSort(prev, key) {
  if (!prev || prev.key !== key) return { key, dir: "asc" };
  return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
}

export function sortRows(rows, sort, getValue) {
  if (!sort?.key) return rows;

  const dirMul = sort.dir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = getValue(a, sort.key);
    const bv = getValue(b, sort.key);

    // Handle undefined/null
    if (av == null && bv == null) return 0;
    if (av == null) return -1 * dirMul;
    if (bv == null) return 1 * dirMul;

    // Numbers
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dirMul;
    }

    // Strings
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (as < bs) return -1 * dirMul;
    if (as > bs) return 1 * dirMul;
    return 0;
  });
}

export function sortIndicator(sort, key) {
  if (!sort || sort.key !== key) return "";
  return sort.dir === "asc" ? " ▲" : " ▼";
}
