export class Canvas {
  width: number;
  height: number;
  grid: string[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => Array(width).fill(' '));
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  set(x: number, y: number, ch: string): void {
    if (this.inBounds(x, y)) {
      this.grid[y][x] = ch;
    }
  }

  get(x: number, y: number): string {
    if (this.inBounds(x, y)) {
      return this.grid[y][x];
    }
    return ' ';
  }

  writeText(x: number, y: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.set(x + i, y, text[i]);
    }
  }

  toString(): string {
    const lines = this.grid.map(row => row.join('').replace(/\s+$/, ''));
    const minIndent = lines.reduce((min, line) => {
      if (line.length === 0) return min;
      const leading = line.match(/^ */)![0].length;
      return Math.min(min, leading);
    }, Infinity);
    if (minIndent > 0 && minIndent < Infinity) {
      return lines.map(line => line.slice(minIndent)).join('\n');
    }
    return lines.join('\n');
  }
}
