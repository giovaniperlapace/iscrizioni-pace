/** Physical blocks supplied for the final ceremony; no individual seat IDs. */
export function closingSectorLayout(code: string, capacity: number) {
  const blocks: { x: number; y: number; rows: number; columns: number }[] = [];
  if (["A", "B", "C", "D", "E"].includes(code)) {
    if (capacity !== (code === "E" ? 470 : 350)) return null;
    for (let block = 0; block < 4; block++) {
      const narrow = block === 3;
      blocks.push({ x: block * 112, y: 0, rows: 10, columns: narrow ? 5 : 10 });
    }
    if (code === "E") {
      for (let block = 0; block < 3; block++) blocks.push({ x: block * 112, y: 112, rows: 4, columns: 10 });
    }
  } else if (code === "ESTERNO" && capacity === 1200) {
    for (let block = 0; block < 12; block++) {
      blocks.push({ x: (block % 3) * 112, y: Math.floor(block / 3) * 112, rows: 10, columns: 10 });
    }
  } else return null;
  return blocks.flatMap((block, index) => Array.from({ length: block.rows * block.columns }, (_, seat) => ({
    block: index + 1,
    row: Math.floor(seat / block.columns) + 1,
    column: seat % block.columns + 1,
    x: block.x + (seat % block.columns) * 10,
    y: block.y + Math.floor(seat / block.columns) * 10,
  })));
}
